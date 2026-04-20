from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# =======================
# Location Schemas
# =======================
class LocationBase(BaseModel):
    latitude: float
    longitude: float

class LocationCreate(LocationBase):
    pass

class PredictionRequest(BaseModel):
    lat: float
    lon: float

class Location(LocationBase):
    location_id: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# =======================
# Weather Schemas
# =======================
class WeatherBase(BaseModel):
    temperature: Optional[float] = None
    feels_like: Optional[float] = None
    condition: Optional[str] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    wind_speed: Optional[float] = None
    cloud_cover: Optional[int] = None
    visibility: Optional[float] = None
    precipitation: Optional[float] = None

class WeatherCreate(WeatherBase):
    pass

class Weather(WeatherBase):
    weather_id: int
    location_id: int
    fetched_at: datetime

    model_config = {"from_attributes": True}


# =======================
# Environmental Data Schemas
# =======================
class EnvironmentalDataBase(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None

class EnvironmentalDataCreate(EnvironmentalDataBase):
    pass

class EnvironmentalData(EnvironmentalDataBase):
    data_id: int
    location_id: int
    fetched_at: datetime

    model_config = {"from_attributes": True}


# =======================
# Prediction Schemas
# =======================
class PredictionBase(BaseModel):
    predicted_aqi: Optional[int] = None
    aqi_category: Optional[str] = None

class PredictionCreate(PredictionBase):
    pass

class Prediction(PredictionBase):
    prediction_id: int
    data_id: int
    predicted_at: datetime

    model_config = {"from_attributes": True}


# =======================
# Health Alert Schemas
# =======================
class HealthAlertBase(BaseModel):
    alert_message: Optional[str] = None
    recommendation: Optional[str] = None

class HealthAlertCreate(HealthAlertBase):
    pass

class HealthAlert(HealthAlertBase):
    alert_id: int
    prediction_id: int

    model_config = {"from_attributes": True}
