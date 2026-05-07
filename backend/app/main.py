# main.py — Main API (dashboard endpoint)
from typing import List, Dict, Any, Optional
import time
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import xml.etree.ElementTree as ET
import html
import hashlib
import time
import re
from sqlalchemy.orm import Session
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache to prevent Open-Meteo 429 rate limits
API_CACHE = {}
CACHE_TTL = 900  # 15 minutes
# Import our new database modules
from app.database.database import engine, Base, get_db
from app.database import schemas, crud
from app.model.inference_router import create_predictor
import os
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Initialize ML Predictor
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(os.path.dirname(__file__), "model", "models")
predictor = create_predictor(models_dir=MODELS_DIR)
executor = ThreadPoolExecutor(max_workers=10)

app = FastAPI()

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


# ✅ Convert weather code → readable condition
def get_weather_condition(code):
    weather_map = {
        0: "Clear",
        1: "Partly Cloudy",
        2: "Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Rime Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        56: "Freezing Drizzle",
        57: "Freezing Drizzle",
        61: "Light Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        71: "Light Snow",
        73: "Moderate Snow",
        75: "Heavy Snow",
        77: "Snow Grains",
        80: "Rain Showers",
        81: "Rain Showers",
        82: "Heavy Rain Showers",
        85: "Snow Showers",
        86: "Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm + Hail",
        99: "Heavy Hail"
    }
    return weather_map.get(code, "Unknown")

import datetime
def get_moon_phase(date: datetime.date) -> str:
    # Known new moon date
    new_moon = datetime.date(2000, 1, 6)
    diff = date - new_moon
    days = diff.days % 29.53058867
    
    if days < 1 or days >= 28.5: return "New Moon"
    if days < 6.5: return "Waxing Crescent"
    if days < 8.5: return "First Quarter"
    if days < 14: return "Waxing Gibbous"
    if days < 16: return "Full Moon"
    if days < 21: return "Waning Gibbous"
    if days < 23.5: return "Last Quarter"
    return "Waning Crescent"


# ✅ Convert wind degree → direction (16 points)
def get_wind_direction(deg):
    val = int((deg / 22.5) + 0.5)
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return dirs[val % 16]


def get_hourly_value_for_current_time(hourly_times, hourly_values, current_time, default=None):
    if not hourly_values:
        return default

    # current_weather.time can be like 2026-03-31T15:15; hourly times are typically 2026-03-31T15:00
    hour_key = f"{current_time[:13]}:00" if current_time and len(current_time) >= 13 else None

    if hour_key and hourly_times:
        try:
            idx = hourly_times.index(hour_key)
            return hourly_values[idx]
        except (ValueError, IndexError):
            pass

    return hourly_values[0] if hourly_values else default


# ✅ MAIN WEATHER API
@app.get("/weather")
def get_weather(lat: float, lon: float, db: Session = Depends(get_db)):

    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=relativehumidity_2m,visibility&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto"

    response = requests.get(url)
    data = response.json()

    current = data["current_weather"]
    hourly = data.get("hourly", {})
    hourly_times = hourly.get("time", [])

    humidity = get_hourly_value_for_current_time(
        hourly_times,
        hourly.get("relativehumidity_2m", []),
        current.get("time"),
        default=None,
    )
    visibility_m = get_hourly_value_for_current_time(
        hourly_times,
        hourly.get("visibility", []),
        current.get("time"),
        default=10000,
    )

    weather = {
        "temperature": current["temperature"],
        "max_temp": data.get("daily", {}).get("temperature_2m_max", [None])[0],
        "min_temp": data.get("daily", {}).get("temperature_2m_min", [None])[0],
        "humidity": humidity,
        "wind_speed": current["windspeed"],
        "wind_direction": get_wind_direction(current["winddirection"]),
        "visibility": visibility_m / 1000,  # meters → km
        "condition": get_weather_condition(current["weathercode"]),
        "is_day": current.get("is_day", 1),
        "uv_index": data.get("daily", {}).get("uv_index_max", [None])[0]
    }

    # Save to PostgreSQL (if DB is active)
    if db:
        try:
            logger.info(f"Saving weather data for lat={lat}, lon={lon}")
            
            # 1. Create Location
            loc_schema = schemas.LocationCreate(latitude=lat, longitude=lon)
            db_loc = crud.create_location(db, loc_schema)
            logger.info(f"✓ Location created with ID: {db_loc.location_id}")
            
            # 2. Save to Weather table
            weather_schema = schemas.WeatherCreate(
                temperature=weather["temperature"],
                feels_like=weather.get("feels_like"),
                condition=weather["condition"],
                humidity=weather["humidity"],
                pressure=None,
                wind_speed=weather["wind_speed"],
                wind_direction=weather["wind_direction"],
                cloud_cover=None,
                visibility=weather["visibility"],
                precipitation=None,
                max_temp=weather["max_temp"],
                min_temp=weather["min_temp"],
                is_day=weather["is_day"],
                uv_index=weather["uv_index"]
            )
            db_weather = crud.create_weather(db, weather_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Weather data created with ID: {db_weather.weather_id}")
            
            # 3. Create Environmental Data
            env_schema = schemas.EnvironmentalDataCreate(
                temperature=weather["temperature"],
                humidity=weather["humidity"]
            )
            db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Environmental data created with ID: {db_env.data_id}")
            
        except Exception as e:
            logger.error(f"Failed to save weather data to DB: {e}", exc_info=True)
    else:
        logger.warning("Database connection not available (db is None)")

    return weather


# ✅ Convert US AQI to readable status
def get_aqi_status(aqi):
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

def get_health_alert_for_aqi(aqi):
    """Generate health alert message and recommendation based on AQI"""
    if aqi <= 50:
        return {
            "message": "Air quality is good",
            "recommendation": "Enjoy outdoor activities"
        }
    elif aqi <= 100:
        return {
            "message": "Air quality is moderate",
            "recommendation": "Unusually sensitive people should consider limiting prolonged outdoor activity"
        }
    elif aqi <= 150:
        return {
            "message": "Air quality is unhealthy for sensitive groups",
            "recommendation": "Members of sensitive groups should limit prolonged outdoor activity"
        }
    elif aqi <= 200:
        return {
            "message": "Air quality is unhealthy",
            "recommendation": "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects"
        }
    elif aqi <= 300:
        return {
            "message": "Air quality is very unhealthy",
            "recommendation": "Health alert: The risk of health effects is increased for everyone"
        }
    else:
        return {
            "message": "Air quality is hazardous",
            "recommendation": "Health warning of emergency conditions: everyone is more likely to be affected"
        }

# ✅ MAIN AQI API (Using Open-Meteo Air Quality)
@app.get("/aqi")
def get_aqi(lat: float, lon: float, db: Session = Depends(get_db)):
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto"
    
    response = requests.get(url)
    data = response.json()
    
    current = data.get("current", {})
    us_aqi = current.get("us_aqi", 0)
    
    aqi_data = {
        "aqi": us_aqi,
        "status": get_aqi_status(us_aqi),
        "pm2_5": current.get("pm2_5", 0),
        "pm10": current.get("pm10", 0),
        "carbon_monoxide": current.get("carbon_monoxide", 0),
        "nitrogen_dioxide": current.get("nitrogen_dioxide", 0),
        "sulphur_dioxide": current.get("sulphur_dioxide", 0),
        "ozone": current.get("ozone", 0)
    }

    # Save to PostgreSQL (if DB is active)
    if db:
        try:
            logger.info(f"Saving AQI data for lat={lat}, lon={lon}")
            
            # 1. Create Location
            loc_schema = schemas.LocationCreate(latitude=lat, longitude=lon)
            db_loc = crud.create_location(db, loc_schema)
            logger.info(f"✓ Location created with ID: {db_loc.location_id}")
            
            # 2. Create Environmental Data
            env_schema = schemas.EnvironmentalDataCreate(
                pm2_5=aqi_data["pm2_5"],
                pm10=aqi_data["pm10"],
                no2=aqi_data["nitrogen_dioxide"],
                co=aqi_data["carbon_monoxide"],
                so2=aqi_data["sulphur_dioxide"],
                o3=aqi_data["ozone"]
            )
            db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Environmental data created with ID: {db_env.data_id}")
            
            # 3. Create Prediction entry to map the API status logic back to health alerts
            pred_schema = schemas.PredictionCreate(
                predicted_aqi=us_aqi,
                aqi_category=aqi_data["status"]
            )
            db_pred = crud.create_prediction(db, pred_schema, data_id=db_env.data_id)
            logger.info(f"✓ Prediction created with ID: {db_pred.prediction_id}, AQI: {us_aqi}")
            
            # 4. Create Health Alert based on AQI
            health_alert_info = get_health_alert_for_aqi(us_aqi)
            alert_schema = schemas.HealthAlertCreate(
                alert_message=health_alert_info["message"],
                recommendation=health_alert_info["recommendation"]
            )
            db_alert = crud.create_health_alert(db, alert_schema, prediction_id=db_pred.prediction_id)
            logger.info(f"✓ Health alert created with ID: {db_alert.alert_id}")
            
        except Exception as e:
            logger.error(f"Failed to save AQI data to DB: {e}", exc_info=True)
    else:
        logger.warning("Database connection not available (db is None)")

    return aqi_data

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
                
                # Create Weather Data
                weather_schema = schemas.WeatherCreate(
                    temperature=temp,
                    condition=get_weather_condition(weather_code),
                    humidity=humidity,
                    pressure=pressure,
                    wind_speed=wind_speed,
                    wind_direction=get_wind_direction(wind_dir),
                    cloud_cover=cloudcover,
                    visibility=visibility_km,
                    precipitation=rain,
                    is_day=is_day,
                    uv_index=uv_index
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
async def get_forecast(request: schemas.PredictionRequest):
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

        # 3. Process Hourly Trends (for charts)
        w_hourly = weather_data.get("hourly", {})
        aq_hourly = aq_data.get("hourly", {})
        
        processed_hourly = []
        times = aq_hourly.get("time", [])
        for i in range(len(times)):
            time_str = times[i]
            
            try:
                # We use string matching for the timestamp to sync weather and AQ hourly
                wx_idx = w_hourly.get("time", []).index(time_str)
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

            # Provide a fallback for missing AQI values so the chart line does not completely break
            hr_aqi = aq_hourly.get("us_aqi", [])[i] if i < len(aq_hourly.get("us_aqi", [])) else None
            
            processed_hourly.append({
                "time": time_str,
                "aqi": hr_aqi,
                "pm2_5": aq_hourly.get("pm2_5", [])[i] if i < len(aq_hourly.get("pm2_5", [])) else 0,
                "pm10": aq_hourly.get("pm10", [])[i] if i < len(aq_hourly.get("pm10", [])) else 0,
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