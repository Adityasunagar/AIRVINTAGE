import React from 'react';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudFog, 
  CloudLightning, 
  Snowflake, 
  CloudSun,
  CloudDrizzle
} from 'lucide-react';

const WeatherIcon = ({ code, size = 24 }) => {
  // Mapping based on Open-Meteo WMO Codes using pure inline colors (Tailwind classes disabled)
  if (code === 0) return <Sun size={size} color="#facc15" />;
  if (code >= 1 && code <= 3) return <CloudSun size={size} color="#cbd5e1" />;
  if (code === 45 || code === 48) return <CloudFog size={size} color="#94a3b8" />;
  if (code >= 51 && code <= 57) return <CloudDrizzle size={size} color="#7dd3fc" />;
  if (code >= 61 && code <= 67) return <CloudRain size={size} color="#38bdf8" />;
  if (code >= 71 && code <= 77) return <Snowflake size={size} color="#e0f2fe" />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} color="#0284c7" />;
  if (code >= 85 && code <= 86) return <Snowflake size={size} color="#bae6fd" />;
  if (code >= 95) return <CloudLightning size={size} color="#c084fc" />;
  
  return <Cloud size={size} color="#e2e8f0" />;
};

export default WeatherIcon;
