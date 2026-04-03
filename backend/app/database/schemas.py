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

class Location(LocationBase):
    location_id: int
    timestamp: datetime

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
