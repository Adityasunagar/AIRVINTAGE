from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import xml.etree.ElementTree as ET
import html

app = FastAPI()

# ✅ Allow frontend access
origins = [
    "http://localhost:3000",
    "http://localhost:6669",
    "http://127.0.0.1:3000",
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
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Fog",
        51: "Drizzle",
        53: "Drizzle",
        55: "Drizzle",
        56: "Drizzle",
        57: "Drizzle",
        61: "Rainy",
        63: "Rainy",
        65: "Heavy Rain",
        66: "Rainy",
        67: "Heavy Rain",
        71: "Snow",
        73: "Snow",
        75: "Snow",
        77: "Snow",
        80: "Rainy",
        81: "Rainy",
        82: "Heavy Rain",
        85: "Snow",
        86: "Snow",
        95: "Storm",
        96: "Storm",
        99: "Storm",
    }
    return weather_map.get(code, "Cloudy")


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

    return hourly_values[0]


# ✅ MAIN WEATHER API
@app.get("/weather")
def get_weather(lat: float, lon: float):

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

    return weather


# ✅ Convert US AQI to readable status
def get_aqi_status(aqi):
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

# ✅ MAIN AQI API (Using Open-Meteo Air Quality)
@app.get("/aqi")
def get_aqi(lat: float, lon: float):
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

    return aqi_data

# ✅ FETCH NEWS FROM RSS FEEDS
def parse_rss(url, limit=10):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"Error fetching RSS {url}: Status {response.status_code}")
            return []
            
        root = ET.fromstring(response.content.strip())
        # findall(".//item") works regardless of nested structure (rss -> channel -> item)
        items = root.findall(".//item")
        
        news_list = []
        for item in items[:limit]:
            # findtext is a shortcut for item.find(tag).text
            title = item.findtext("title", "No Title")
            link = item.findtext("link", "#")
            description = item.findtext("description", "")
            pub_date = item.findtext("pubDate", "")
            
            # Extract Image URL
            image_url = None
            
            # 1. Try to find media:content
            media_content = item.findall('.//{http://search.yahoo.com/mrss/}content')
            if media_content and media_content[0].get('url'):
                image_url = media_content[0].get('url')
                
            # 2. Try to find img src in description
            if not image_url:
                import re
                img_match = re.search(r'<img[^>]+src="([^">]+)"', description)
                if img_match:
                    src = img_match.group(1)
                    # Ignore tiny tracking images or broken thumbnails from Google News
                    if "news.google.com" not in src:
                        image_url = src

            # Remove HTML tags from description
            clean_desc = re.sub('<[^<]+?>', '', description)
            # Unescape HTML entities
            clean_title = html.unescape(title)
            clean_desc = html.unescape(clean_desc)

            news_list.append({
                "title": clean_title,
                "link": link,
                "description": clean_desc[:200] + "..." if len(clean_desc) > 200 else clean_desc,
                "pubDate": pub_date,
                "imageUrl": image_url
            })
        return news_list
    except Exception as e:
        print(f"Error parsing RSS {url}: {e}")
        return []

@app.get("/news")
def get_news(region: str = "world"):
    if region.lower() == "india":
        # Google News Search for India Environment/Pollution
        url = "https://news.google.com/rss/search?q=environment+pollution+india&hl=en-IN&gl=IN&ceid=IN:en"
    else:
        # Earth.org Feed for Global Environment News
        url = "https://earth.org/feed/"
        
    return {"region": region, "news": parse_rss(url)}