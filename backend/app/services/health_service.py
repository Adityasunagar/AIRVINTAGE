"""
health_service.py
Health alert generation and DB persistence helpers.
"""

from app.services.aqi_service import get_health_alert_for_aqi


def build_health_alert_schema(aqi: float):
    """Return a dict suitable for constructing a HealthAlertCreate schema."""
    info = get_health_alert_for_aqi(aqi)
    return {
        "alert_message": info["message"],
        "recommendation": info["recommendation"],
    }
