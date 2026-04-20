# main.py — Main API (dashboard endpoint)
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import requests
import xml.etree.ElementTree as ET
import html
from sqlalchemy.orm import Session
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


# ✅ Convert wind degree → direction
def get_wind_direction(deg):
    dirs = ["N","NE","E","SE","S","SW","W","NW"]
    return dirs[int((deg + 22.5) / 45) % 8]


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

    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=relativehumidity_2m,visibility&daily=temperature_2m_max,temperature_2m_min&timezone=auto"

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
        "is_day": current.get("is_day", 1)
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
                cloud_cover=None,
                visibility=weather["visibility"],
                precipitation=None
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
                pm10=aqi_data["pm10"]
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

# ✅ FETCH NEWS FROM RSS FEEDS
def parse_rss(url, limit=10):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, text/xml, */*",
        "Accept-Language": "en-US,en;q=0.9"
    }
    try:
        logger.info(f"📍 Starting request to: {url}")
        response = requests.get(url, headers=headers, timeout=15)
        logger.info(f"📊 Response status: {response.status_code}, Content length: {len(response.content)} bytes")
        
        if response.status_code != 200:
            logger.error(f"❌ HTTP Error {response.status_code} for {url}")
            return []
        
        if not response.content:
            logger.error(f"❌ Empty response body from {url}")
            return []
        
        # Parse XML
        try:
            root = ET.fromstring(response.content.strip())
            logger.info(f"✅ XML parsed successfully")
        except ET.ParseError as e:
            logger.error(f"❌ XML Parse error: {e}")
            logger.error(f"First 500 chars of response: {response.text[:500]}")
            return []
            
        # Find items - try RSS first, then Atom
        items = root.findall(".//item")
        if not items:
            items = root.findall(".//{http://www.w3.org/2005/Atom}entry")
        
        logger.info(f"📋 Found {len(items)} total items in feed")
        
        news_list = []
        for idx, item in enumerate(items[:limit]):
            # Extract RSS fields
            title = item.findtext("title", "").strip() or item.findtext("{http://www.w3.org/2005/Atom}title", "").strip()
            link = item.findtext("link", "") or item.findtext("{http://www.w3.org/2005/Atom}link", "")
            description = item.findtext("description", "") or item.findtext("{http://www.w3.org/2005/Atom}summary", "")
            pub_date = item.findtext("pubDate", "") or item.findtext("{http://www.w3.org/2005/Atom}published", "")
            
            # Skip if no valid title
            if not title:
                logger.debug(f"⏭️ Item {idx} skipped: no title found")
                continue
            
            # Extract image URL
            image_url = None
            
            # 1. Try media:content (BBC primary method)
            media_content = item.findall('.//{http://search.yahoo.com/mrss/}content')
            if media_content:
                for mc in media_content:
                    url_attr = mc.get('url')
                    if url_attr and url_attr.strip():
                        image_url = url_attr
                        logger.debug(f"✅ Found image via media:content - {title[:30]}...")
                        break
            
            # 2. Try media:thumbnail
            if not image_url:
                media_thumb = item.findall('.//{http://search.yahoo.com/mrss/}thumbnail')
                if media_thumb:
                    for mt in media_thumb:
                        url_attr = mt.get('url')
                        if url_attr and url_attr.strip():
                            image_url = url_attr
                            logger.debug(f"✅ Found image via media:thumbnail - {title[:30]}...")
                            break
            
            # 3. Try img src in description with validation
            if not image_url and description:
                import re
                img_matches = re.finditer(r'<img[^>]+src="([^">]+)"', description)
                for img_match in img_matches:
                    src = img_match.group(1).strip()
                    # Validate image URL is not tracking pixel or broken
                    if (src and 
                        "tracking" not in src.lower() and 
                        "pixel" not in src.lower() and
                        "1x1" not in src and
                        "news.google.com" not in src):
                        image_url = src
                        logger.debug(f"✅ Found image in description - {title[:30]}...")
                        break

            # Clean HTML and entities
            import re
            clean_desc = re.sub('<[^<]+?>', '', description).strip()
            clean_title = html.unescape(title)
            clean_desc = html.unescape(clean_desc)
            
            # Final validation
            if not clean_title.strip():
                logger.debug(f"⏭️ Item skipped after cleanup: title empty")
                continue

            news_list.append({
                "title": clean_title,
                "link": link or "#",
                "description": clean_desc[:200] + "..." if len(clean_desc) > 200 else clean_desc,
                "pubDate": pub_date,
                "imageUrl": image_url
            })
            logger.debug(f"✅ Article {len(news_list)} added: {clean_title[:40]}...")
        
        logger.info(f"✅ Successfully parsed {len(news_list)} articles from feed")
        return news_list
    except requests.exceptions.Timeout:
        logger.error(f"⏱️ Timeout fetching {url} (15s limit)")
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"🌐 Network error for {url}: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"❌ Unexpected error parsing {url}: {str(e)}", exc_info=True)
        return []

@app.get("/news")
def get_news(region: str = "world"):
    if region.lower() == "india":
        # Google News Search for India - Weather & Air Quality
        urls = [
            "https://news.google.com/rss/search?q=weather+air+quality+india&hl=en-IN&gl=IN&ceid=IN:en",
            "https://news.google.com/rss/search?q=pollution+aqi+india&hl=en-IN&gl=IN&ceid=IN:en"
        ]
    else:
        # World news - Weather & Air Quality / AQI focused
        urls = [
            "https://news.google.com/rss/search?q=world+air+quality+aqi&hl=en&gl=US&ceid=US:en",
            "https://news.google.com/rss/search?q=global+weather+pollution&hl=en&gl=US&ceid=US:en",
            "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"  # BBC Science & Environment fallback
        ]
    
    news_data = []
    for url in urls:
        logger.info(f"🔄 Attempting to fetch news from: {url}")
        news_data = parse_rss(url)
        if news_data:
            logger.info(f"✅ Successfully fetched {len(news_data)} articles from {url}")
            break
        else:
            logger.warning(f"⚠️ No articles found from {url}, trying next source...")
    
    logger.info(f"✅ Fetched {len(news_data)} news articles for region: {region}")
    return {"region": region, "news": news_data, "count": len(news_data)}


# ✅ UNIFIED PREDICTION POINT (PRODUCTION READY)
@app.post("/predict")
async def predict_aqi(request: schemas.PredictionRequest, db: Session = Depends(get_db)):
    """
    Production-grade endpoint that fetches live pollutants and weather,
    feeds them into the AirVintage ML Router, and returns a high-fidelity result.
    """
    lat = request.lat
    lon = request.lon
    
    # 1. Prepare API URLs
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=relativehumidity_2m,surface_pressure,precipitation,temperature_2m,windspeed_10m,winddirection_10m,weathercode&timezone=auto"
    aq_url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto"

    loop = asyncio.get_event_loop()
    
    try:
        # 2. Fetch data concurrently
        def fetch_json(url):
            try:
                r = requests.get(url, timeout=10)
                r.raise_for_status()
                return r.json()
            except Exception as e:
                logger.error(f"API Fetch Error for {url}: {e}")
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

        # 4. Extract weather
        curr_wx = weather_data.get("current_weather", {})
        temp = curr_wx.get("temperature", 25.0)
        wind_speed = curr_wx.get("windspeed", 5.0)
        wind_dir = curr_wx.get("winddirection", 0)
        
        # Hourly data for pressure, humidity, rain
        hourly = weather_data.get("hourly", {})
        h_times = hourly.get("time", [])
        timestamp_str = curr_wx.get("time")
        
        humidity = get_hourly_value_for_current_time(h_times, hourly.get("relativehumidity_2m", []), timestamp_str, default=50.0)
        pressure = get_hourly_value_for_current_time(h_times, hourly.get("surface_pressure", []), timestamp_str, default=1013.0)
        rain = get_hourly_value_for_current_time(h_times, hourly.get("precipitation", []), timestamp_str, default=0.0)

        # 5. Run ML Inference
        if timestamp_str:
            try:
                dt_obj = datetime.datetime.fromisoformat(timestamp_str)
                iso_ts = dt_obj.strftime("%Y-%m-%d %H:%M:%S")
            except:
                iso_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            iso_ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        result = predictor.predict_by_location(
            lat=lat, lon=lon,
            datetime_str=iso_ts,
            pm25=pm2_5, pm10=pm10, no2=no2, so2=so2, co=co, o3=o3,
            temp_c=temp, humidity=humidity, 
            wind_speed=wind_speed, wind_dir=wind_dir,
            pressure_hpa=pressure, rain_mm=rain
        )

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
                    pm10=pm10
                )
                db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
                
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
                "humidity": humidity,
                "wind_speed": wind_speed,
                "pressure": pressure,
                "rain": rain,
                "condition": get_weather_condition(curr_wx.get("weathercode", 0))
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
    weather_forecast_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,uv_index_max,windspeed_10m_max,sunrise,sunset&hourly=temperature_2m,precipitation_probability,relativehumidity_2m,surface_pressure,visibility,weather_code,is_day,apparent_temperature&timezone=auto"
    aq_forecast_url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&hourly=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&past_days=7&forecast_days=7&timezone=auto"

    loop = asyncio.get_event_loop()
    
    try:
        def fetch_json(url):
            try:
                r = requests.get(url, timeout=10)
                r.raise_for_status()
                return r.json()
            except Exception as e:
                logger.error(f"API Fetch Error for {url}: {e}")
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
            except (ValueError, KeyError, IndexError):
                temp = None
                apparent_temp = None
                precip_prob = 0
                hum = 0
                weather_code = 0
                is_day = 1

            processed_hourly.append({
                "time": time_str,
                "aqi": aq_hourly.get("us_aqi", [])[i],
                "pm2_5": aq_hourly.get("pm2_5", [])[i],
                "pm10": aq_hourly.get("pm10", [])[i],
                "temp": temp,
                "apparent_temp": apparent_temp,
                "weather_code": weather_code,
                "is_day": is_day,
                "precip_prob": precip_prob,
                "humidity": hum
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