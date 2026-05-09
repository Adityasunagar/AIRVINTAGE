"""
weather_service.py
Weather utility helpers — condition mapping, wind direction, moon phase.
All logic here was previously inline in main.py — centralised for reuse.
"""

import datetime


WEATHER_CODE_MAP = {
    0: "Clear",
    1: "Partly Cloudy",
    2: "Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Freezing Drizzle",
    57: "Freezing Drizzle",
    61: "Light Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Rain Showers",
    81: "Rain Showers",
    82: "Heavy Rain Showers",
    85: "Snow Showers",
    86: "Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm + Hail",
    99: "Heavy Hail",
}

WIND_DIRECTIONS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
]


def get_weather_condition(code: int) -> str:
    """Convert an Open-Meteo weather code to a human-readable condition."""
    return WEATHER_CODE_MAP.get(code, "Unknown")


def get_wind_direction(deg: float) -> str:
    """Convert a wind bearing (degrees) to a 16-point compass direction."""
    val = int((deg / 22.5) + 0.5)
    return WIND_DIRECTIONS[val % 16]


def get_moon_phase(date: datetime.date) -> str:
    """Approximate moon phase for a given date."""
    new_moon = datetime.date(2000, 1, 6)
    diff = date - new_moon
    days = diff.days % 29.53058867

    if days < 1 or days >= 28.5:
        return "New Moon"
    if days < 6.5:
        return "Waxing Crescent"
    if days < 8.5:
        return "First Quarter"
    if days < 14:
        return "Waxing Gibbous"
    if days < 16:
        return "Full Moon"
    if days < 21:
        return "Waning Gibbous"
    if days < 23.5:
        return "Last Quarter"
    return "Waning Crescent"


def get_hourly_value_for_current_time(
    hourly_times: list,
    hourly_values: list,
    current_time: str,
    default=None,
):
    """Pick the correct hourly value matching the current forecast time."""
    if not hourly_values:
        return default

    hour_key = (
        f"{current_time[:13]}:00"
        if current_time and len(current_time) >= 13
        else None
    )

    if hour_key and hourly_times:
        try:
            idx = hourly_times.index(hour_key)
            return hourly_values[idx]
        except (ValueError, IndexError):
            pass

    return hourly_values[0] if hourly_values else default
