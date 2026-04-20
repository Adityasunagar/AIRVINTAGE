"""
airvintage_ml.aqi_utils
=======================
AQI constants, bucket thresholds, and shared column definitions
used across all 6 AirVintage models.
"""

# ─── AQI Bucket Thresholds (India CPCB Standard) ──────────────────────────────
AQI_LIMITS = {
    "Good"         : (0,   50),
    "Satisfactory" : (51,  100),
    "Moderate"     : (101, 200),
    "Poor"         : (201, 300),
    "Very Poor"    : (301, 400),
    "Severe"       : (401, 9999),
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
    "Good"         : "#2ecc71",
    "Satisfactory" : "#f1c40f",
    "Moderate"     : "#e67e22",
    "Poor"         : "#e74c3c",
    "Very Poor"    : "#8e44ad",
    "Severe"       : "#2c3e50",
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
        "Satisfactory": {
            "message": "Air quality is acceptable.",
            "recommendation": "Most people can enjoy outdoor activities without risk."
        },
        "Moderate": {
            "message": "Air quality is moderate.",
            "recommendation": "Sensitive individuals (asthma, heart disease) should reduce intense outdoor exertion."
        },
        "Poor": {
            "message": "Everyone may begin to experience health effects.",
            "recommendation": "Avoid prolonged or heavy outdoor exertion. Children and elderly should stay indoors."
        },
        "Very Poor": {
            "message": "Health alert: serious risk to the general public.",
            "recommendation": "Avoid all outdoor physical activity. Keep windows closed and use air purifiers."
        },
        "Severe": {
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
