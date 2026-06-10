# aqi.py — AQI (Open-Meteo Air Quality + logic)
import concurrent.futures

import requests
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .database.database import get_db
from .database import schemas, crud

logger = logging.getLogger(__name__)

router = APIRouter()


# ✅ Convert US AQI to readable status
def get_aqi_status(aqi):
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"


def get_health_alert_for_aqi(aqi):
    """Generate health alert message and recommendation based on AQI."""
    if aqi <= 50:
        return {"message": "Air quality is good", "recommendation": "Enjoy outdoor activities"}
    elif aqi <= 100:
        return {
            "message": "Air quality is moderate",
            "recommendation": "Unusually sensitive people should consider limiting prolonged outdoor activity",
        }
    elif aqi <= 150:
        return {
            "message": "Air quality is unhealthy for sensitive groups",
            "recommendation": "Members of sensitive groups should limit prolonged outdoor activity",
        }
    elif aqi <= 200:
        return {
            "message": "Air quality is unhealthy",
            "recommendation": (
                "Some members of the general public may experience health effects; "
                "members of sensitive groups may experience more serious health effects"
            ),
        }
    elif aqi <= 300:
        return {
            "message": "Air quality is very unhealthy",
            "recommendation": "Health alert: The risk of health effects is increased for everyone",
        }
    else:
        return {
            "message": "Air quality is hazardous",
            "recommendation": "Health warning of emergency conditions: everyone is more likely to be affected",
        }


# ✅ MAIN AQI API
@router.get("/aqi")
def get_aqi(lat: float, lon: float, db: Session = Depends(get_db)):
    aq_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        f"&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
        f"&timezone=auto"
    )
    # Fetch temperature + humidity from weather API concurrently (fix: Issue 3)
    wx_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,relative_humidity_2m"
        f"&timezone=auto"
    )

    def _get(url):
        return requests.get(url, timeout=15).json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        aq_future = pool.submit(_get, aq_url)
        wx_future = pool.submit(_get, wx_url)
        data    = aq_future.result()
        wx_data = wx_future.result()

    current    = data.get("current", {})
    wx_current = wx_data.get("current", {})
    us_aqi     = current.get("us_aqi", 0)

    # Temperature and humidity now correctly populated
    temperature = wx_current.get("temperature_2m")
    humidity    = wx_current.get("relative_humidity_2m")

    # Generate advanced health recommendations
    pollutants_dict = {
        "pm2_5": current.get("pm2_5", 0),
        "pm10": current.get("pm10", 0),
        "no2": current.get("nitrogen_dioxide", 0),
        "co": current.get("carbon_monoxide", 0),
        "so2": current.get("sulphur_dioxide", 0),
        "o3": current.get("ozone", 0),
    }
    weather_dict = {
        "temperature": temperature,
        "humidity": humidity,
    }

    from app.services.health_service import generate_advanced_health_recommendations, build_health_alert_schema
    adv_recs = generate_advanced_health_recommendations(us_aqi, pollutants_dict, weather_dict)

    aqi_data = {
        "aqi":              us_aqi,
        "status":           get_aqi_status(us_aqi),
        "pm2_5":            current.get("pm2_5", 0),
        "pm10":             current.get("pm10", 0),
        "carbon_monoxide":  current.get("carbon_monoxide", 0),
        "nitrogen_dioxide": current.get("nitrogen_dioxide", 0),
        "sulphur_dioxide":  current.get("sulphur_dioxide", 0),
        "ozone":            current.get("ozone", 0),
        "health_recommendations": adv_recs,
    }

    # ── Persist to PostgreSQL ──────────────────────────────────────────────
    if db:
        try:
            logger.info(f"Saving AQI data for lat={lat}, lon={lon}")

            # 1. Location
            db_loc = crud.create_location(db, schemas.LocationCreate(latitude=lat, longitude=lon))
            logger.info(f"✓ Location ID: {db_loc.location_id}")

            # 2. Environmental Data — all 8 fields now stored (fix: Issue 3)
            env_schema = schemas.EnvironmentalDataCreate(
                temperature=temperature,
                humidity=humidity,
                pm2_5=aqi_data["pm2_5"],
                pm10=aqi_data["pm10"],
                no2=aqi_data["nitrogen_dioxide"],
                co=aqi_data["carbon_monoxide"],
                so2=aqi_data["sulphur_dioxide"],
                o3=aqi_data["ozone"],
            )
            db_env = crud.create_environmental_data(db, env_schema, location_id=db_loc.location_id)
            logger.info(f"✓ Environmental data ID: {db_env.data_id}")

            # 3. Prediction
            db_pred = crud.create_prediction(
                db,
                schemas.PredictionCreate(predicted_aqi=us_aqi, aqi_category=aqi_data["status"]),
                data_id=db_env.data_id,
            )
            logger.info(f"✓ Prediction ID: {db_pred.prediction_id}, AQI: {us_aqi}")

            # 4. Health Alert
            alert_fields = build_health_alert_schema(
                us_aqi,
                pm2_5=aqi_data["pm2_5"],
                pm10=aqi_data["pm10"],
                no2=aqi_data["nitrogen_dioxide"],
                co=aqi_data["carbon_monoxide"],
                so2=aqi_data["sulphur_dioxide"],
                o3=aqi_data["ozone"],
                temperature=temperature,
                humidity=humidity
            )
            db_alert = crud.create_health_alert(
                db,
                schemas.HealthAlertCreate(**alert_fields),
                prediction_id=db_pred.prediction_id,
            )
            logger.info(f"✓ Health alert ID: {db_alert.alert_id}")

        except Exception as e:
            logger.error(f"Failed to save AQI data to DB: {e}", exc_info=True)
    else:
        logger.warning("Database connection not available (db is None)")

    return aqi_data
