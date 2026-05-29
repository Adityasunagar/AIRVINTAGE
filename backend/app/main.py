# main.py — Main API (dashboard endpoint)
import datetime
import time
import os
import re
import html
import hashlib
import logging
import asyncio
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

import requests
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Database modules
from app.database.database import engine, Base, get_db
from app.database import schemas, crud

# ML predictor
from app.model.inference_router import create_predictor

# Canonical service helpers (fixes Issues 5 & 6 — no more duplicates in this file)
from app.services.weather_service import (
    get_weather_condition,
    get_wind_direction,
    get_moon_phase,
    get_hourly_value_for_current_time,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache to prevent Open-Meteo 429 rate limits
API_CACHE = {}
CACHE_TTL = 900  # 15 minutes

# Initialize ML Predictor
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(os.path.dirname(__file__), "model", "models")
predictor = create_predictor(models_dir=MODELS_DIR)
executor = ThreadPoolExecutor(max_workers=10)

app = FastAPI()

from app.aqi import router as aqi_router, get_aqi_status, get_health_alert_for_aqi
app.include_router(aqi_router)

# Automatically create all tables (if they don't exist)
if engine:
    Base.metadata.create_all(bind=engine)

# ✅ Allow frontend access
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:6669",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:6669",
]

# Allow adding production domains via env var
if os.getenv("FRONTEND_URL"):
    origins.extend(os.getenv("FRONTEND_URL").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "AirVintage Backend Running"}


# Helper functions are imported from app.services.weather_service (see top of file)


# ✅ MAIN WEATHER API  (fix Issue 1 — modern URL, all fields stored)
@app.get("/weather")
def get_weather(lat: float, lon: float, db: Session = Depends(get_db)):
    # Modern `current=` parameter captures all fields that were previously NULL
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
        f"surface_pressure,cloud_cover,precipitation,wind_speed_10m,"
        f"wind_direction_10m,wind_gusts_10m,is_day,weather_code"
        f"&daily=temperature_2m_max,temperature_2m_min,uv_index_max"
        f"&hourly=visibility"
        f"&timezone=auto"
    )

    response = requests.get(url, timeout=15)
    data = response.json()

    current      = data.get("current", {})
    hourly       = data.get("hourly", {})
    hourly_times = hourly.get("time", [])
    timestamp    = current.get("time")

    visibility_m = get_hourly_value_for_current_time(
        hourly_times, hourly.get("visibility", []), timestamp, default=10000
    )

    weather = {
        "temperature":    current.get("temperature_2m"),
        "feels_like":     current.get("apparent_temperature"),
        "max_temp":       data.get("daily", {}).get("temperature_2m_max", [None])[0],
        "min_temp":       data.get("daily", {}).get("temperature_2m_min", [None])[0],
        "humidity":       current.get("relative_humidity_2m"),
        "pressure":       current.get("surface_pressure"),
        "cloud_cover":    current.get("cloud_cover"),
        "precipitation":  current.get("precipitation"),
        "wind_speed":     current.get("wind_speed_10m"),
        "wind_gusts":     current.get("wind_gusts_10m"),
        "wind_direction": get_wind_direction(current.get("wind_direction_10m", 0)),
        "visibility":     (visibility_m or 10000) / 1000,  # metres → km
        "condition":      get_weather_condition(current.get("weather_code", 0)),
        "is_day":         current.get("is_day", 1),
        "uv_index":       data.get("daily", {}).get("uv_index_max", [None])[0],
    }

    # ── Persist to PostgreSQL ────────────────────────────────────────────
    if db:
        try:
            logger.info(f"Saving weather data for lat={lat}, lon={lon}")

            db_loc = crud.create_location(db, schemas.LocationCreate(latitude=lat, longitude=lon))
            logger.info(f"✓ Location ID: {db_loc.location_id}")

            # All previously-NULL fields now populated
            weather_schema = schemas.WeatherCreate(
                temperature=weather["temperature"],
                feels_like=weather["feels_like"],
                condition=weather["condition"],
                humidity=weather["humidity"],
                pressure=weather["pressure"],
                wind_speed=weather["wind_speed"],
                wind_direction=weather["wind_direction"],
                cloud_cover=weather["cloud_cover"],
                visibility=weather["visibility"],
                precipitation=weather["precipitation"],
                max_temp=weather["max_temp"],
                min_temp=weather["min_temp"],
                is_day=weather["is_day"],
                uv_index=weather["uv_index"],
            )
            db_weather = crud.create_weather(db, weather_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Weather ID: {db_weather.weather_id}")

            env_schema = schemas.EnvironmentalDataCreate(
                temperature=weather["temperature"],
                humidity=weather["humidity"],
            )
            db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Environmental data ID: {db_env.data_id}")

        except Exception as e:
            logger.error(f"Failed to save weather data to DB: {e}", exc_info=True)
    else:
        logger.warning("Database connection not available (db is None)")

    return weather




# ─────────────────────────────────────────────────────────────────
# NEWS CACHE  (in-memory, 30-minute TTL)
# ─────────────────────────────────────────────────────────────────
NEWS_CACHE: dict = {}          # id -> article dict
NEWS_REGION_CACHE: dict = {}  # region -> {articles, fetched_at}
NEWS_TTL = 1800                # 30 minutes


def _make_id(url: str) -> str:
    """Stable 12-char hex ID from a URL, used as the in-app article identifier."""
    return hashlib.md5(url.encode()).hexdigest()[:12]


# ─────────────────────────────────────────────────────────────────
# RSS PARSER
# ─────────────────────────────────────────────────────────────────
def parse_rss(url: str, limit: int = 12) -> list:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code != 200 or not response.content:
            return []
        try:
            root = ET.fromstring(response.content.strip())
        except ET.ParseError:
            return []

        items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
        news_list = []

        for item in items[:limit]:
            title_raw   = item.findtext("title", "").strip() or item.findtext("{http://www.w3.org/2005/Atom}title", "").strip()
            link        = item.findtext("link", "") or item.findtext("{http://www.w3.org/2005/Atom}link", "")
            description = item.findtext("description", "") or item.findtext("{http://www.w3.org/2005/Atom}summary", "")
            pub_date    = item.findtext("pubDate", "") or item.findtext("{http://www.w3.org/2005/Atom}published", "")
            source_el   = item.find("source")
            source_name = source_el.text.strip() if source_el is not None and source_el.text else ""

            if not title_raw:
                continue

            # ── Image extraction ──
            image_url = None
            for tag in item.findall('.//{http://search.yahoo.com/mrss/}content') + item.findall('.//{http://search.yahoo.com/mrss/}thumbnail'):
                u = tag.get('url', '').strip()
                if u:
                    image_url = u
                    break
            if not image_url and description:
                m = re.search(r'<img[^>]+src="([^"]+)"', description)
                if m and 'tracking' not in m.group(1) and '1x1' not in m.group(1):
                    image_url = m.group(1)

            # ── Clean text ──
            clean_title = html.unescape(re.sub('<[^>]+>', '', title_raw)).strip()
            clean_desc  = html.unescape(re.sub('<[^>]+>', '', description)).strip()
            
            # Build a longer content block from the RSS description (no scraping needed)
            content = clean_desc  # Full description as available from RSS

            if not clean_title:
                continue

            article_id = _make_id(link or clean_title)

            article = {
                "id":          article_id,
                "title":       clean_title,
                "link":        link or "#",
                "description": clean_desc[:300] + "..." if len(clean_desc) > 300 else clean_desc,
                "content":     content,
                "pubDate":     pub_date,
                "imageUrl":    image_url,
                "source":      source_name,
                "category":    "environment",
            }
            NEWS_CACHE[article_id] = article   # store in global cache
            news_list.append(article)

        return news_list

    except Exception as e:
        logger.error(f"RSS parse error: {e}", exc_info=True)
        return []


# ─────────────────────────────────────────────────────────────────
# GET /news  — list articles (with TTL cache)
# ─────────────────────────────────────────────────────────────────
def fetch_guardian_news(region: str):
    key = os.environ.get("GUARDIAN_API_KEY", "test")
    q = "environment OR climate OR pollution"
    if region.lower() != "world":
        q = f"({q}) AND {region}"
    url = f"https://content.guardianapis.com/search?q={q}&section=environment&show-fields=thumbnail,bodyText,trailText&api-key={key}"
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        articles = []
        for item in data.get("response", {}).get("results", []):
            fields = item.get("fields", {})
            article_id = _make_id(item.get("webUrl", ""))
            article = {
                "id": article_id,
                "title": item.get("webTitle", ""),
                "link": item.get("webUrl", ""),
                "description": fields.get("trailText", ""),
                "content": fields.get("bodyText", ""),
                "pubDate": item.get("webPublicationDate", ""),
                "imageUrl": fields.get("thumbnail", ""),
                "source": "The Guardian",
                "category": "environment"
            }
            NEWS_CACHE[article_id] = article
            articles.append(article)
        return articles
    except Exception as e:
        logger.error(f"Guardian API error: {e}")
        return []

def fetch_gnews(region: str):
    key = os.environ.get("GNEWS_API_KEY")
    if not key:
        return []
    
    country = "in" if region.lower() == "india" else "us"
    url = f"https://gnews.io/api/v4/search?q=air+quality+OR+pollution+OR+AQI&lang=en&country={country}&max=10&apikey={key}"
    try:
        r = requests.get(url, timeout=10)
        data = r.json()
        articles = []
        for item in data.get("articles", []):
            article_id = _make_id(item.get("url", ""))
            article = {
                "id": article_id,
                "title": item.get("title", ""),
                "link": item.get("url", ""),
                "description": item.get("description", ""),
                "content": item.get("content", ""),
                "pubDate": item.get("publishedAt", ""),
                "imageUrl": item.get("image", ""),
                "source": item.get("source", {}).get("name", "GNews"),
                "category": "environment"
            }
            NEWS_CACHE[article_id] = article
            articles.append(article)
        return articles
    except Exception as e:
        logger.error(f"GNews API error: {e}")
        return []

@app.get("/news")
async def get_news(region: str = "world", category: str = ""):
    cache_key = f"{region}:{category}"
    cached = NEWS_REGION_CACHE.get(cache_key)
    if cached and (time.time() - cached["fetched_at"]) < NEWS_TTL:
        logger.info(f"✅ Serving news from cache for: {cache_key}")
        return {"region": region, "news": cached["articles"], "count": len(cached["articles"]), "cached": True}

    loop = asyncio.get_event_loop()
    
    # 1. Fetch from Premium APIs concurrently
    guardian_task = loop.run_in_executor(executor, fetch_guardian_news, region)
    gnews_task = loop.run_in_executor(executor, fetch_gnews, region)
    
    guardian_articles, gnews_articles = await asyncio.gather(guardian_task, gnews_task)
    articles = guardian_articles + gnews_articles
    
    # 2. Fallback to robust RSS scraping if APIs fail or keys missing
    if not articles:
        region_lower = region.lower()
        if region_lower == "india":
            urls = [
                "https://news.google.com/rss/search?q=weather+air+quality+AQI+india+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
                "https://news.google.com/rss/search?q=pollution+environment+india+when:7d&hl=en-IN&gl=IN&ceid=IN:en",
            ]
        elif region_lower == "world":
            urls = [
                "https://news.google.com/rss/search?q=air+quality+AQI+climate+change+when:7d&hl=en&gl=US&ceid=US:en",
                "https://news.google.com/rss/search?q=global+air+pollution+environment+when:7d&hl=en&gl=US&ceid=US:en",
                "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
            ]
        else:
            q = region.replace(" ", "+")
            urls = [
                f"https://news.google.com/rss/search?q=weather+AQI+pollution+{q}+when:7d&hl=en&gl=US&ceid=US:en",
                f"https://news.google.com/rss/search?q=air+quality+environment+{q}+when:7d&hl=en&gl=US&ceid=US:en",
            ]

        for url in urls:
            rss_articles = await loop.run_in_executor(executor, parse_rss, url)
            if rss_articles:
                articles = rss_articles
                break
            logger.warning(f"⚠️ No articles from {url}")

    NEWS_REGION_CACHE[cache_key] = {"articles": articles, "fetched_at": time.time()}
    logger.info(f"✅ Fetched {len(articles)} articles for: {cache_key}")
    return {"region": region, "news": articles, "count": len(articles), "cached": False}


# ─────────────────────────────────────────────────────────────────
# GET /news/{id}  — return single cached article (no scraping)
# ─────────────────────────────────────────────────────────────────
@app.get("/news/{article_id}")
def get_article(article_id: str):
    article = NEWS_CACHE.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found. Please refresh the news list first.")
    return article


# ✅ UNIFIED PREDICTION POINT (PRODUCTION READY)
@app.post("/predict")
async def predict_aqi(request: schemas.PredictionRequest, db: Session = Depends(get_db)):
    """
    Production-grade endpoint that fetches live pollutants and weather,
    feeds them into the AirVintage ML Router, and returns a high-fidelity result.
    """
    lat = request.lat
    lon = request.lon
    
    # 1. Prepare API URLs - Using modern `current` parameter for exact real-time data
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=visibility,precipitation_probability,dewpoint_2m&daily=uv_index_max,sunrise,sunset&timezone=auto"
    aq_url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto"

    loop = asyncio.get_event_loop()
    
    try:
        # 2. Fetch data concurrently
        def fetch_json(url):
            """Fetch URL with increased timeout, 15-min cache, and one automatic retry."""
            now = time.time()
            # 1. Check cache
            if url in API_CACHE:
                cached_time, cached_data = API_CACHE[url]
                if now - cached_time < CACHE_TTL:
                    return cached_data

            # 2. Fetch with retry
            for attempt in range(2):
                try:
                    r = requests.get(url, timeout=25)
                    r.raise_for_status()
                    data = r.json()
                    API_CACHE[url] = (now, data)
                    return data
                except requests.exceptions.ReadTimeout:
                    if attempt == 0:
                        logger.warning(f"Timeout on attempt 1 for {url[:80]}..., retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"API Fetch Timed Out (2 attempts) for {url[:80]}...")
                        # On failure, return old cached data if it exists (stale-while-revalidate)
                        if url in API_CACHE:
                            return API_CACHE[url][1]
                        return {}
                except Exception as e:
                    logger.error(f"API Fetch Error for {url[:80]}...: {e}")
                    if url in API_CACHE:
                        return API_CACHE[url][1]
                    return {}
            return {}

        weather_task = loop.run_in_executor(executor, fetch_json, weather_url)
        aq_task = loop.run_in_executor(executor, fetch_json, aq_url)
        
        weather_data, aq_data = await asyncio.gather(weather_task, aq_task)
        
        if not weather_data or not aq_data:
            return {"error": "External API failure", "details": "Could not fetch weather or air quality data"}

        # 3. Extract pollutants
        curr_aq = aq_data.get("current", {})
        pm2_5 = curr_aq.get("pm2_5", 0)
        pm10 = curr_aq.get("pm10", 0)
        co = curr_aq.get("carbon_monoxide", 0)
        no2 = curr_aq.get("nitrogen_dioxide", 0)
        so2 = curr_aq.get("sulphur_dioxide", 0)
        o3 = curr_aq.get("ozone", 0)

        # 4. Extract exact current weather
        curr_wx = weather_data.get("current", {})
        temp = curr_wx.get("temperature_2m", 25.0)
        wind_speed = curr_wx.get("wind_speed_10m", 5.0)
        wind_dir = curr_wx.get("wind_direction_10m", 0)
        humidity = curr_wx.get("relative_humidity_2m", 50.0)
        pressure = curr_wx.get("surface_pressure", 1013.0)
        rain = curr_wx.get("precipitation", 0.0)
        cloudcover = curr_wx.get("cloud_cover", 0)
        weather_code = curr_wx.get("weather_code", 0)
        is_day = curr_wx.get("is_day", 1)
        feels_like = curr_wx.get("apparent_temperature", temp)
        wind_gusts = curr_wx.get("wind_gusts_10m", wind_speed)
        timestamp_str = curr_wx.get("time")
        
        # Visibility is only available in hourly, so we still parse it
        hourly = weather_data.get("hourly", {})
        h_times = hourly.get("time", [])
        visibility_km = get_hourly_value_for_current_time(h_times, hourly.get("visibility", []), timestamp_str, default=10000) / 1000.0
        precip_prob = get_hourly_value_for_current_time(h_times, hourly.get("precipitation_probability", []), timestamp_str, default=0)
        dewpoint = get_hourly_value_for_current_time(h_times, hourly.get("dewpoint_2m", []), timestamp_str, default=temp)
        
        daily = weather_data.get("daily", {})
        uv_index = daily.get("uv_index_max", [0])[0]
        sunrise = daily.get("sunrise", [None])[0]
        sunset = daily.get("sunset", [None])[0]
        moon_phase = get_moon_phase(datetime.datetime.now().date())

        # 5. Run ML Inference
        if timestamp_str:
            try:
                dt_obj = datetime.datetime.fromisoformat(timestamp_str)
                iso_ts = dt_obj.strftime("%Y-%m-%d %H:%M:%S")
            except:
                iso_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            iso_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            result = predictor.predict_by_location(
                lat=lat, lon=lon,
                datetime_str=iso_ts,
                pm25=pm2_5, pm10=pm10, no2=no2, so2=so2, co=co, o3=o3,
                temp_c=temp, humidity=humidity, 
                wind_speed=wind_speed, wind_dir=wind_dir,
                pressure_hpa=pressure, rain_mm=rain
            )
        except Exception as pred_err:
            logger.warning(f"ML Predictor failed, falling back to heuristic: {pred_err}")
            # Fallback to Open-Meteo's own AQI
            fallback_aqi = curr_aq.get("us_aqi", 0)
            result = {
                "predicted_aqi": fallback_aqi,
                "aqi_category": get_aqi_status(fallback_aqi),
                "health_advisory": get_health_alert_for_aqi(fallback_aqi),
                "model": "fallback_api"
            }

        # 6. Database Persistence
        if db:
            try:
                # Create Location
                loc_schema = schemas.LocationCreate(latitude=lat, longitude=lon)
                db_loc = crud.create_location(db, loc_schema)
                
                # Create Environmental Data
                env_schema = schemas.EnvironmentalDataCreate(
                    temperature=temp,
                    humidity=humidity,
                    pm2_5=pm2_5,
                    pm10=pm10,
                    no2=no2,
                    co=co,
                    so2=so2,
                    o3=o3
                )
                db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
                
                # Create Weather Data (fix Issue 2 — feels_like, max_temp, min_temp now stored)
                weather_schema = schemas.WeatherCreate(
                    temperature=temp,
                    feels_like=feels_like,
                    condition=get_weather_condition(weather_code),
                    humidity=humidity,
                    pressure=pressure,
                    wind_speed=wind_speed,
                    wind_direction=get_wind_direction(wind_dir),
                    cloud_cover=cloudcover,
                    visibility=visibility_km,
                    precipitation=rain,
                    is_day=is_day,
                    uv_index=uv_index,
                    # max_temp / min_temp come from daily[0]
                    max_temp=daily.get("temperature_2m_max", [None])[0],
                    min_temp=daily.get("temperature_2m_min", [None])[0],
                )
                crud.create_weather(db, weather_schema, location_id=db_loc.location_id)
                
                # Create Prediction
                pred_schema = schemas.PredictionCreate(
                    predicted_aqi=int(result["predicted_aqi"]),
                    aqi_category=result["aqi_category"]
                )
                db_pred = crud.create_prediction(db, pred_schema, data_id=db_env.data_id)
                
                # Create Health Alert
                alert_schema = schemas.HealthAlertCreate(
                    alert_message=result["health_advisory"]["message"],
                    recommendation=result["health_advisory"]["recommendation"]
                )
                crud.create_health_alert(db, alert_schema, prediction_id=db_pred.prediction_id)
                logger.info(f"💾 Logged ML prediction to DB for {result.get('nearest_city', 'Unknown')}")
            except Exception as db_err:
                logger.error(f"Failed to log prediction to DB: {db_err}")

        # 7. Add extra info for frontend compatibility
        result.update({
            "aqi": int(result["predicted_aqi"]), 
            "status": result["aqi_category"],
            "pm2_5": pm2_5,
            "pm10": pm10,
            "carbon_monoxide": co,
            "nitrogen_dioxide": no2,
            "sulphur_dioxide": so2,
            "ozone": o3,
            "weather_data": {
                "temperature": temp,
                "feels_like": feels_like,
                "humidity": humidity,
                "dewpoint": dewpoint,
                "wind_speed": wind_speed,
                "wind_gusts": wind_gusts,
                "wind_direction": get_wind_direction(wind_dir),
                "wind_deg": wind_dir,
                "pressure": pressure,
                "rain": rain,
                "precip_prob": precip_prob,
                "visibility": visibility_km,
                "cloudcover": cloudcover,
                "uv_index": uv_index,
                "condition": get_weather_condition(weather_code),
                "sunrise": sunrise,
                "sunset": sunset,
                "moon_phase": moon_phase
            }
        })

        return result

    except Exception as e:
        logger.error(f"Prediction Error: {str(e)}", exc_info=True)
        return {"error": "Prediction failed", "details": str(e)}

# ✅ ADVANCED 7-DAY FORECAST (PRODUCTION READY)
@app.post("/forecast")
async def get_forecast(request: schemas.PredictionRequest, db: Session = Depends(get_db)):
    """
    Unified forecast endpoint for Weather and Air Quality (7 days).
    Fetches hourly and daily data concurrently.
    """
    lat, lon = request.lat, request.lon
    
    # 1. URLs for Weather and Air Quality (Forecast + 7 Days History)
    weather_forecast_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,uv_index_max,windspeed_10m_max,sunrise,sunset&hourly=temperature_2m,precipitation_probability,relativehumidity_2m,surface_pressure,visibility,weather_code,is_day,apparent_temperature,windspeed_10m,cloudcover&timezone=auto"
    aq_forecast_url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&hourly=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&past_days=7&forecast_days=7&timezone=auto"

    loop = asyncio.get_event_loop()
    
    try:
        def fetch_json(url):
            """Fetch URL with increased timeout, 15-min cache, and one automatic retry."""
            now = time.time()
            if url in API_CACHE:
                cached_time, cached_data = API_CACHE[url]
                if now - cached_time < CACHE_TTL:
                    return cached_data

            for attempt in range(2):
                try:
                    r = requests.get(url, timeout=25)
                    r.raise_for_status()
                    data = r.json()
                    API_CACHE[url] = (now, data)
                    return data
                except requests.exceptions.ReadTimeout:
                    if attempt == 0:
                        logger.warning(f"Timeout on attempt 1 for {url[:80]}..., retrying...")
                        time.sleep(2)
                    else:
                        logger.error(f"Forecast API Timed Out (2 attempts) for {url[:80]}...")
                        if url in API_CACHE:
                            return API_CACHE[url][1]
                        return {}
                except Exception as e:
                    logger.error(f"API Fetch Error for {url[:80]}...: {e}")
                    if url in API_CACHE:
                        return API_CACHE[url][1]
                    return {}
            return {}

        w_task = loop.run_in_executor(executor, fetch_json, weather_forecast_url)
        aq_task = loop.run_in_executor(executor, fetch_json, aq_forecast_url)
        
        weather_data, aq_data = await asyncio.gather(w_task, aq_task)

        # 2. Process Daily Weather (7 Days)
        daily = weather_data.get("daily", {})
        processed_daily = []
        for i in range(len(daily.get("time", []))):
            date_obj = datetime.datetime.strptime(daily["time"][i], "%Y-%m-%d").date()
            processed_daily.append({
                "date": daily["time"][i],
                "temp_max": daily["temperature_2m_max"][i],
                "temp_min": daily["temperature_2m_min"][i],
                "weather_code": daily["weathercode"][i],
                "condition": get_weather_condition(daily["weathercode"][i]),
                "precip": daily["precipitation_sum"][i],
                "uv": daily["uv_index_max"][i],
                "wind": daily["windspeed_10m_max"][i],
                "sunrise": daily.get("sunrise", [])[i] if daily.get("sunrise") else None,
                "sunset": daily.get("sunset", [])[i] if daily.get("sunset") else None,
                "moon_phase": get_moon_phase(date_obj)
            })

        # 3a. Persist daily forecast to DB (fix Issue 4)
        if db and processed_daily:
            try:
                db_loc = crud.create_location(db, schemas.LocationCreate(latitude=lat, longitude=lon))
                # Build AQI lookup per date from hourly AQ data
                aq_daily_aqi = {}
                aq_daily_pm25 = {}
                aq_daily_pm10 = {}
                for ts, aqi_val, pm25_val, pm10_val in zip(
                    aq_data.get("hourly", {}).get("time", []),
                    aq_data.get("hourly", {}).get("us_aqi", []),
                    aq_data.get("hourly", {}).get("pm2_5", []),
                    aq_data.get("hourly", {}).get("pm10", []),
                ):
                    date_key = ts[:10]
                    aq_daily_aqi.setdefault(date_key, [])
                    aq_daily_pm25.setdefault(date_key, [])
                    aq_daily_pm10.setdefault(date_key, [])
                    if aqi_val is not None: aq_daily_aqi[date_key].append(aqi_val)
                    if pm25_val is not None: aq_daily_pm25[date_key].append(pm25_val)
                    if pm10_val is not None: aq_daily_pm10[date_key].append(pm10_val)

                forecast_schemas = []
                for day in processed_daily:
                    d = day["date"]
                    avg = lambda lst: round(sum(lst) / len(lst), 2) if lst else None
                    forecast_schemas.append(schemas.ForecastDailyCreate(
                        forecast_date=d,
                        temp_max=day["temp_max"],
                        temp_min=day["temp_min"],
                        condition=day["condition"],
                        weather_code=day["weather_code"],
                        precipitation=day["precip"],
                        uv_index=day["uv"],
                        wind_speed_max=day["wind"],
                        sunrise=day["sunrise"],
                        sunset=day["sunset"],
                        moon_phase=day["moon_phase"],
                        aqi=avg(aq_daily_aqi.get(d, [])),
                        pm2_5=avg(aq_daily_pm25.get(d, [])),
                        pm10=avg(aq_daily_pm10.get(d, [])),
                    ))
                crud.bulk_create_forecast_daily(db, forecast_schemas, location_id=db_loc.location_id)
                logger.info(f"💾 Saved {len(forecast_schemas)} daily forecast rows for lat={lat}, lon={lon}")
            except Exception as db_err:
                logger.error(f"Failed to save forecast to DB: {db_err}", exc_info=True)

        # 3. Process Hourly Trends (for charts)
        w_hourly = weather_data.get("hourly", {})
        aq_hourly = aq_data.get("hourly", {})
        
        processed_hourly = []
        aq_times = aq_hourly.get("time", [])
        w_times = w_hourly.get("time", [])
        
        # Merge and sort all unique times from both APIs
        all_times = sorted(list(set(aq_times + w_times)))
        
        for time_str in all_times:
            # Weather data match
            try:
                wx_idx = w_times.index(time_str)
                temp = w_hourly["temperature_2m"][wx_idx]
                apparent_temp = w_hourly.get("apparent_temperature", [])[wx_idx] if "apparent_temperature" in w_hourly else temp
                precip_prob = w_hourly["precipitation_probability"][wx_idx]
                hum = w_hourly["relativehumidity_2m"][wx_idx]
                weather_code = w_hourly.get("weather_code", [])[wx_idx] if "weather_code" in w_hourly else 0
                is_day = w_hourly.get("is_day", [])[wx_idx] if "is_day" in w_hourly else 1
                wind = w_hourly.get("windspeed_10m", [])[wx_idx] if "windspeed_10m" in w_hourly else 0
                cloud = w_hourly.get("cloudcover", [])[wx_idx] if "cloudcover" in w_hourly else 0
            except (ValueError, KeyError, IndexError):
                temp = None
                apparent_temp = None
                precip_prob = 0
                hum = 0
                weather_code = 0
                is_day = 1
                wind = 0
                cloud = 0

            # Air Quality data match
            try:
                aq_idx = aq_times.index(time_str)
                hr_aqi = aq_hourly.get("us_aqi", [])[aq_idx]
                pm2_5 = aq_hourly.get("pm2_5", [])[aq_idx]
                pm10 = aq_hourly.get("pm10", [])[aq_idx]
            except (ValueError, KeyError, IndexError):
                hr_aqi = None
                pm2_5 = 0
                pm10 = 0
            
            processed_hourly.append({
                "time": time_str,
                "aqi": hr_aqi,
                "pm2_5": pm2_5,
                "pm10": pm10,
                "temp": temp,
                "apparent_temp": apparent_temp,
                "weather_code": weather_code,
                "is_day": is_day,
                "precip_prob": precip_prob,
                "humidity": hum,
                "wind": wind,
                "cloud": cloud
            })

        return {
            "daily": processed_daily,
            "hourly": processed_hourly,
            "units": {
                "temp": "°C",
                "aqi": "US AQI",
                "precip": "mm"
            }
        }

    except Exception as e:
        logger.error(f"Forecast Error: {str(e)}", exc_info=True)
        return {"error": "Forecast generation failed", "details": str(e)}