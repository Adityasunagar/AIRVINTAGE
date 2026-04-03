from sqlalchemy.orm import Session
from . import models, schemas

def create_location(db: Session, location: schemas.LocationCreate):
    db_location = models.Location(
        latitude=location.latitude,
        longitude=location.longitude
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

def create_environmental_data(db: Session, data: schemas.EnvironmentalDataCreate, location_id: int):
    db_env_data = models.EnvironmentalData(
        **data.model_dump(),
        location_id=location_id
    )
    db.add(db_env_data)
    db.commit()
    db.refresh(db_env_data)
    return db_env_data

def create_prediction(db: Session, prediction: schemas.PredictionCreate, data_id: int):
    db_prediction = models.Prediction(
        **prediction.model_dump(),
        data_id=data_id
    )
    db.add(db_prediction)
    db.commit()
    db.refresh(db_prediction)
    return db_prediction

def create_health_alert(db: Session, alert: schemas.HealthAlertCreate, prediction_id: int):
    db_alert = models.HealthAlert(
        **alert.model_dump(),
        prediction_id=prediction_id
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert
