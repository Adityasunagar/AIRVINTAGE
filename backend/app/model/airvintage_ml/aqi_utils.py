"""
airvintage_ml.aqi_utils
=======================
AQI constants, bucket thresholds, and shared column definitions
used across all 6 AirVintage models.
"""

# ─── AQI Bucket Thresholds (US EPA Standard) ──────────────────────────────
AQI_LIMITS = {
    "Good"                           : (0,   50),
    "Moderate"                       : (51,  100),
    "Unhealthy for Sensitive Groups" : (101, 150),
    "Unhealthy"                      : (151, 200),
    "Very Unhealthy"                 : (201, 300),
    "Hazardous"                      : (301, 9999),
}

# ─── Shared Pollutant Columns ──────────────────────────────────────────────────
POLLUTANT_COLS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
]

# Alternate naming used in air_cleaned.csv
POLLUTANT_COLS_ALT = [
    "PM2_5", "PM10", "NO2", "SO2", "CO", "O3",
]

# ─── Weather Columns (air_cleaned.csv) ────────────────────────────────────────
WEATHER_COLS = [
    "Temp_C", "Humidity", "Wind_Speed",
    "Wind_Direction", "Pressure_hPa", "Rain_mm",
]

# ─── AQI Color Palette for Plots ──────────────────────────────────────────────
AQI_COLORS = {
    "Good"                           : "#4ade80",
    "Moderate"                       : "#facc15",
    "Unhealthy for Sensitive Groups" : "#fb923c",
    "Unhealthy"                      : "#f87171",
    "Very Unhealthy"                 : "#c084fc",
    "Hazardous"                      : "#7e2222",
}


def aqi_to_bucket(aqi: float) -> str:
    """
    Convert a numeric AQI value to its CPCB category string.

    Parameters
    ----------
    aqi : float
        Predicted or actual AQI value.

    Returns
    -------
    str
        Category label: 'Good', 'Satisfactory', 'Moderate',
        'Poor', 'Very Poor', or 'Severe'.
    """
    if aqi is None or (isinstance(aqi, float) and aqi != aqi):
        return "Unknown"
    aqi = float(aqi)
    for bucket, (lo, hi) in AQI_LIMITS.items():
        if lo <= aqi <= hi:
            return bucket
    return "Severe"


def health_advisory(bucket: str) -> dict:
    """
    Return a structured health advisory for a given AQI bucket.
    Returns a dict with 'message' and 'recommendation' for DB logging and UI.
    """
    advisories = {
        "Good": {
            "message": "Air quality is good.",
            "recommendation": "Ideal for all outdoor activities and physical exercise."
        },
        "Moderate": {
            "message": "Air quality is acceptable.",
            "recommendation": "Unusually sensitive people should consider limiting prolonged outdoor activity."
        },
        "Unhealthy for Sensitive Groups": {
            "message": "Air quality is unhealthy for sensitive groups.",
            "recommendation": "Members of sensitive groups should limit prolonged outdoor exertion."
        },
        "Unhealthy": {
            "message": "Air quality is unhealthy.",
            "recommendation": "Everyone may begin to experience health effects. Limit prolonged outdoor exertion."
        },
        "Very Unhealthy": {
            "message": "Health alert: serious risk to the general public.",
            "recommendation": "Avoid prolonged or heavy outdoor exertion. Everyone should stay indoors if possible."
        },
        "Hazardous": {
            "message": "Health warning: Emergency conditions.",
            "recommendation": "Total avoidance of outdoor activities. Everyone should remain indoors with filtered air."
        },
        "Unknown": {
            "message": "AQI data unavailable.",
            "recommendation": "Check sensors or local authorities for real-time data."
        },
    }
    return advisories.get(bucket, {
        "message": "No specific advisory available.",
        "recommendation": "Standard precautions apply."
    })
