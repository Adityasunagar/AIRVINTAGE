from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Location(Base):
    __tablename__ = "locations"
    
    location_id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    environmental_data = relationship("EnvironmentalData", back_populates="location")
    weather_data = relationship("Weather", back_populates="location")


class Weather(Base):
    __tablename__ = "weather"
    
    weather_id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"))
    
    temperature = Column(Float)
    feels_like = Column(Float)
    condition = Column(String)
    humidity = Column(Float)
    pressure = Column(Float)
    wind_speed = Column(Float)
    cloud_cover = Column(Integer)
    visibility = Column(Float)
    precipitation = Column(Float)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    location = relationship("Location", back_populates="weather_data")


class EnvironmentalData(Base):
    __tablename__ = "environmental_data"
    
    data_id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"))
    
    temperature = Column(Float)
    humidity = Column(Float)
    pm2_5 = Column(Float)
    pm10 = Column(Float)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    location = relationship("Location", back_populates="environmental_data")
    predictions = relationship("Prediction", back_populates="environmental_data")


class Prediction(Base):
    __tablename__ = "predictions"
    
    prediction_id = Column(Integer, primary_key=True, index=True)
    data_id = Column(Integer, ForeignKey("environmental_data.data_id"))
    
    predicted_aqi = Column(Integer)
    aqi_category = Column(String)
    predicted_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    environmental_data = relationship("EnvironmentalData", back_populates="predictions")
    health_alerts = relationship("HealthAlert", back_populates="prediction")


class HealthAlert(Base):
    __tablename__ = "health_alerts"
    
    alert_id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(Integer, ForeignKey("predictions.prediction_id"))
    
    alert_message = Column(String)
    recommendation = Column(String)
    
    # Relationships
    prediction = relationship("Prediction", back_populates="health_alerts")
