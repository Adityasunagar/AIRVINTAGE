import { useMemo } from 'react';

export const useSmartRecommendations = (aqiData, weatherData) => {
  return useMemo(() => {
    if (!aqiData || !weatherData) return null;

    const aqi = aqiData.aqi || 0;
    const temp = weatherData.temperature || 25;
    const uv = weatherData.uv_index || 0;
    const rain = weatherData.rain || 0;

    // 1. Calculate Outdoor Activity Score (1-10)
    let score = 10;
    const reasons = [];
    const alerts = [];

    // AQI Logic
    if (aqi > 150) {
      score -= 5;
      reasons.push("Unhealthy air quality");
      alerts.push({
        id: 'aqi_critical',
        type: 'danger',
        icon: '😷',
        title: 'Poor Air Quality',
        message: 'Wear an N95 mask if going outdoors.'
      });
    } else if (aqi > 100) {
      score -= 2;
      reasons.push("Moderate air pollution");
      alerts.push({
        id: 'aqi_warn',
        type: 'warning',
        icon: '🌬️',
        title: 'Moderate AQI',
        message: 'Sensitive groups should limit outdoor time.'
      });
    }

    // Temperature Logic
    if (temp > 35) {
      score -= 4;
      reasons.push("Extreme heat");
      alerts.push({
        id: 'heat',
        type: 'danger',
        icon: '🥵',
        title: 'Heat Warning',
        message: 'Stay hydrated and avoid strenuous activities.'
      });
    } else if (temp > 30) {
      score -= 1;
      reasons.push("High temperature");
    } else if (temp < 5) {
      score -= 3;
      reasons.push("Freezing conditions");
      alerts.push({
        id: 'cold',
        type: 'warning',
        icon: '🥶',
        title: 'Cold Warning',
        message: 'Bundle up to prevent frostbite.'
      });
    } else if (temp < 10) {
      score -= 1;
      reasons.push("Cold temperature");
    }

    // UV Logic
    if (uv > 7) {
      score -= 2;
      reasons.push("High UV index");
      alerts.push({
        id: 'uv',
        type: 'warning',
        icon: '😎',
        title: 'High UV Levels',
        message: 'Apply sunscreen and wear sunglasses.'
      });
    }

    // Rain Logic
    if (rain > 5) {
      score -= 4;
      reasons.push("Heavy precipitation");
      alerts.push({
        id: 'heavy_rain',
        type: 'danger',
        icon: '⛈️',
        title: 'Heavy Rain',
        message: 'Seek shelter and avoid flooded areas.'
      });
    } else if (rain > 0) {
      score -= 2;
      reasons.push("Light rain");
      alerts.push({
        id: 'rain',
        type: 'info',
        icon: '☔',
        title: 'Rain Expected',
        message: 'Don\'t forget your umbrella today!'
      });
    }

    // Clamp score
    score = Math.max(1, Math.min(10, score));

    // Interpretation
    let category = "Poor";
    let color = "#ef4444"; // Red
    if (score >= 8) {
      category = "Excellent";
      color = "#22c55e"; // Green
      if (alerts.length === 0) {
        alerts.push({
          id: 'perfect',
          type: 'success',
          icon: '✨',
          title: 'Perfect Conditions',
          message: 'It\'s a great day for a run or outdoor picnic!'
        });
      }
    } else if (score >= 5) {
      category = "Moderate";
      color = "#eab308"; // Yellow
    }

    // Explanation string
    let explanation = "Conditions are perfect for outdoor activities.";
    if (reasons.length > 0) {
      explanation = `Score reduced due to ${reasons.join(", ")}.`;
    }

    return {
      score,
      category,
      color,
      explanation,
      alerts
    };
  }, [aqiData, weatherData]);
};
