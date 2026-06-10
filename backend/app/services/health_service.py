"""
health_service.py
=================
Advanced Health Recommendation System for AirVintage.
Generates cohort-specific, pollutant-aware, and weather-contextualized advice.
"""

from typing import Dict, Any, List

def generate_advanced_health_recommendations(
    aqi: int,
    pollutants: Dict[str, float],
    weather: Dict[str, float]
) -> Dict[str, Any]:
    """
    Computes precise health recommendations based on AQI, dominant pollutant sub-index,
    and environmental weather factors (temperature, humidity).
    
    Parameters:
      aqi (int): Overall US AQI value
      pollutants (dict): Concentration of pollutants {"pm2_5": x, "pm10": y, "no2": z, "co": w, "so2": u, "o3": v}
      weather (dict): Weather metrics {"temperature": temp_c, "humidity": rh_percent}
    """
    
    # 1. Determine AQI Severity and Base Message
    if aqi <= 50:
        severity = "Good"
        message = "Air quality is satisfactory, and air pollution poses little or no risk."
        mask_needed = False
        mask_type = "None"
        ventilation = "Excellent time to ventilate. Keep windows open."
        outdoor_activity = "Enjoy normal outdoor activities."
    elif aqi <= 100:
        severity = "Moderate"
        message = "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution."
        mask_needed = False
        mask_type = "None"
        ventilation = "Safe to open windows; unusually sensitive individuals should monitor indoor air quality."
        outdoor_activity = "Unusually sensitive people should consider reducing prolonged or heavy outdoor exertion."
    elif aqi <= 150:
        severity = "Unhealthy for Sensitive Groups"
        message = "Members of sensitive groups may experience health effects. The general public is less likely to be affected."
        mask_needed = True
        mask_type = "Surgical mask or light respirator if outdoors for long periods"
        ventilation = "Limit outdoor air ventilation. Keep windows mostly closed."
        outdoor_activity = "Sensitive groups should reduce prolonged or heavy outdoor exertion. General public is fine."
    elif aqi <= 200:
        severity = "Unhealthy"
        message = "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects."
        mask_needed = True
        mask_type = "N95 / N99 respirator recommended for any outdoor activity"
        ventilation = "Keep windows closed. Use recirculating air conditioning if available."
        outdoor_activity = "Everyone should limit prolonged or heavy outdoor exertion. Sensitive groups should avoid outdoor activities."
    elif aqi <= 300:
        severity = "Very Unhealthy"
        message = "Health alert: The risk of health effects is increased for everyone."
        mask_needed = True
        mask_type = "N95 / N99 respirator mandatory for all outdoor exposure"
        ventilation = "Keep all windows and doors closed tightly. Run air purifiers on high."
        outdoor_activity = "Everyone should avoid prolonged or heavy outdoor exertion. Sensitive groups should remain indoors."
    else:
        severity = "Hazardous"
        message = "Health warning of emergency conditions: everyone is more likely to be affected."
        mask_needed = True
        mask_type = "N95 / N99 respirator mandatory; avoid any outdoor exposure"
        ventilation = "Seal windows and doors. Run indoor air purifiers on maximum speed."
        outdoor_activity = "Everyone should avoid all outdoor physical activity. Stay indoors."

    # 2. Determine Dominant Pollutant based on relative CPCB/EPA risk ratio
    # Broken down by standard regulatory reference thresholds
    ratios = {
        "PM2.5": pollutants.get("pm2_5", 0) / 12.0,       # 12 ug/m3 Good threshold
        "PM10": pollutants.get("pm10", 0) / 54.0,         # 54 ug/m3
        "Nitrogen Dioxide (NO₂)": pollutants.get("no2", 0) / 53.0,  # 53 ppb / ug/m3 approx
        "Ozone (O₃)": pollutants.get("o3", 0) / 54.0,      # 54 ppb
        "Carbon Monoxide (CO)": pollutants.get("co", 0) / 4.4,     # 4.4 ppm
        "Sulphur Dioxide (SO₂)": pollutants.get("so2", 0) / 35.0   # 35 ppb
    }
    
    dominant = max(ratios, key=ratios.get)
    max_ratio = ratios[dominant]
    
    # If all pollutants are extremely low, report "None"
    if max_ratio < 0.2:
        dominant = "None"

    # 3. Generate Cohort-Specific Recommendations
    cohorts = {
        "general": "Enjoy normal outdoor activities.",
        "children_elderly": "No precautions needed.",
        "respiratory": "Keep inhalers close if you have asthma.",
        "cardiovascular": "No specific cardiovascular warning.",
        "outdoor_workers": "Enjoy normal working conditions."
    }

    if aqi > 50:
        # PM2.5 / PM10 specific advice
        if "PM" in dominant:
            cohorts["respiratory"] = "Fine particles can penetrate deep into lungs. Individuals with asthma or COPD should keep quick-relief inhalers nearby and monitor for coughing or wheezing."
            cohorts["cardiovascular"] = "Particulate matter can cause cardiovascular strain. Heart disease patients should avoid strenuous activity and seek help if chest pain or shortness of breath occurs."
            cohorts["children_elderly"] = "Children and seniors have higher respiration rates; limit their heavy outdoor play or walking, especially in the mornings."
            cohorts["general"] = "Active adults should scale down outdoor running or heavy exercise if they experience throat tickles or coughing."
            cohorts["outdoor_workers"] = "Take breaks in clean, air-conditioned environments. Consider wearing an N95 mask during heavy labor."
            
        # Ozone specific advice
        elif "Ozone" in dominant:
            cohorts["respiratory"] = "Ozone acts as a powerful oxidant, causing chest tightness and throat irritation. Asthmatics should strictly avoid mid-day and afternoon outdoor exposure when ozone peaks."
            cohorts["cardiovascular"] = "Avoid heavy outdoor labor to reduce general breathing strain."
            cohorts["children_elderly"] = "Children should play indoors during peak sunlight hours (12 PM to 5 PM) when ozone concentration is highest."
            cohorts["general"] = "Shift outdoor training/runs to early morning or late evening when ozone levels are low."
            cohorts["outdoor_workers"] = "Avoid heavy exertion during early afternoon hours. Shift heavy loading/unloading tasks to early morning if possible."
            
        # Other gases (NO2, SO2, CO)
        else:
            cohorts["respiratory"] = f"Airway inflammation is likely due to elevated {dominant}. Keep respiratory medication accessible."
            cohorts["cardiovascular"] = f"Avoid heavy physical exertion to lower cardiovascular stress caused by {dominant} exposure."
            cohorts["children_elderly"] = "Seniors and children should stay in well-ventilated indoor spaces."
            cohorts["outdoor_workers"] = "Limit continuous exposure near high-traffic zones or factory emissions."

    # 4. Integrate Weather Context
    weather_warnings = []
    temp = weather.get("temperature")
    humidity = weather.get("humidity")
    
    if temp is not None:
        if temp >= 35.0:
            weather_warnings.append("⚠️ Extreme Heat Alert: High temperatures amplify the lung-damaging effects of ground-level Ozone and increase cardiovascular strain. Stay hydrated and limit exertion.")
        elif temp <= 5.0:
            weather_warnings.append("⚠️ Cold Air Inversion Warning: Cold, stagnant air acts as a lid, trapping particulate matter near the ground. Avoid early morning outdoor walks as pollution is highly concentrated at ground level.")
            
    if humidity is not None:
        if humidity >= 80.0:
            weather_warnings.append("⚠️ High Humidity Notice: High moisture makes air feel heavy, making breathing more difficult for asthmatics. Dampness can also keep particulate pollutants suspended in the breathing zone.")

    # 5. Compile Actionable Household & Lifestyle Tips
    tips = []
    if aqi <= 50:
        tips.append("Open windows to refresh indoor air with clean outdoor air.")
        tips.append("Great day for outdoor exercise, hiking, or ventilation.")
    else:
        tips.append("Run your indoor air purifier on auto or medium/high settings.")
        tips.append("Avoid burning candles, incense, or frying food indoors, as this creates dangerous particulate matter.")
        if "PM" in dominant:
            tips.append("Wet-mop floors and wipe down surfaces with a damp cloth instead of dry dusting, to avoid releasing settled particles back into the air.")
        if "Ozone" in dominant:
            tips.append("Keep indoor spaces cool with fans or AC; warm air accelerates indoor chemical reactions.")
        tips.append("Ensure your vacuum cleaner has a HEPA filter to capture fine dust.")

    return {
        "aqi": aqi,
        "severity": severity,
        "dominant_pollutant": dominant,
        "general_recommendations": {
            "message": message,
            "mask_needed": mask_needed,
            "mask_type": mask_type,
            "ventilation": ventilation,
            "outdoor_activity": outdoor_activity
        },
        "cohort_recommendations": cohorts,
        "weather_warnings": weather_warnings,
        "actionable_tips": tips[:3] # Return top 3 tips
    }

def build_health_alert_schema(
    aqi: float, 
    pm2_5: float = 0.0, 
    pm10: float = 0.0, 
    no2: float = 0.0, 
    co: float = 0.0, 
    so2: float = 0.0, 
    o3: float = 0.0,
    temperature: float = 25.0,
    humidity: float = 50.0
) -> Dict[str, str]:
    """
    Constructs a dictionary for Database HealthAlert schema.
    Maintains backward compatibility with simple models while leveraging advanced recommendations.
    """
    pollutants = {
        "pm2_5": pm2_5, "pm10": pm10, "no2": no2,
        "co": co, "so2": so2, "o3": o3
    }
    weather = {
        "temperature": temperature, "humidity": humidity
    }
    
    adv = generate_advanced_health_recommendations(int(aqi), pollutants, weather)
    
    # Map back to basic schema keys
    alert_msg = f"{adv['severity']} AQI: {adv['general_recommendations']['message']}"
    if adv["weather_warnings"]:
        alert_msg += " " + " ".join(adv["weather_warnings"])
        
    rec_text = f"Primary advice: {adv['general_recommendations']['outdoor_activity']} "
    rec_text += f"Dominant Pollutant: {adv['dominant_pollutant']}. "
    rec_text += f"For Asthmatics: {adv['cohort_recommendations']['respiratory']} "
    rec_text += f"Tips: " + " ".join(adv["actionable_tips"])

    return {
        "alert_message": alert_msg[:255] if len(alert_msg) > 255 else alert_msg, # safety limit
        "recommendation": rec_text
    }
