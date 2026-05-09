"""
aqi_service.py
AQI status classification and health advisory helpers.
All logic here was previously inline in main.py — centralised for reuse.
"""


def get_aqi_status(aqi: float) -> str:
    """Convert a US AQI value to a readable status string."""
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def get_health_alert_for_aqi(aqi: float) -> dict:
    """Return a health alert message and recommendation based on AQI."""
    if aqi <= 50:
        return {
            "message": "Air quality is good",
            "recommendation": "Enjoy outdoor activities",
        }
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
