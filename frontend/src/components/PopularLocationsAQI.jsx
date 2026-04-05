import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Popular locations (major Indian cities)
const POPULAR_LOCATIONS = [
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
];

/**
 * Displays AQI markers for popular locations
 */
export default function PopularLocationsAQI({ show = true, refreshKey = 0 }) {
  const [locationsAQI, setLocationsAQI] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) {
      console.log('[PopularLocationsAQI] show=false, clearing markers');
      setLocationsAQI([]);
      return;
    }

    console.log('[PopularLocationsAQI] show=true, fetching all locations');
    setLoading(true);

    async function fetchAllLocationsAQI() {
      const results = [];

      for (const location of POPULAR_LOCATIONS) {
        try {
          const aqi = await fetchLocationAQI(location.lat, location.lng);
          console.log(`[PopularLocationsAQI] ${location.name}: AQI=${aqi}`);
          
          if (aqi > 0) {  // Only include if we got actual data
            results.push({
              ...location,
              aqi,
              color: getAQIColor(aqi),
            });
          }
        } catch (err) {
          console.warn(`[PopularLocationsAQI] Failed to fetch AQI for ${location.name}:`, err);
        }
      }

      console.log(`[PopularLocationsAQI] Fetched ${results.length} locations with data:`, results);
      setLocationsAQI(results);
      setLoading(false);
    }

    fetchAllLocationsAQI();
  }, [show, refreshKey]);

  const createCityMarker = (color, aqi) => {
    return L.divIcon({
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
      html: `
        <div style="
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          ${aqi}
        </div>
      `,
    });
  };

  console.log('[PopularLocationsAQI] Rendering:', { show, loading, count: locationsAQI.length });

  if (!show) {
    return null;
  }

  if (loading) {
    console.log('[PopularLocationsAQI] Still loading...');
  }

  return (
    <>
      {locationsAQI.map(location => {
        console.log(`[PopularLocationsAQI] Rendering marker for ${location.name} at [${location.lat}, ${location.lng}]`);
        return (
          <Marker
            key={location.name}
            position={[location.lat, location.lng]}
            icon={createCityMarker(location.color, location.aqi)}
          >
            <Popup className="aqi-popup">
              <div className="aqi-popup-inner">
                <div className="aqi-popup-city" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {location.name}
                </div>
                <div className="aqi-popup-score" style={{ color: location.color, fontSize: '20px', fontWeight: 'bold' }}>
                  {location.aqi}
                </div>
                <div className="aqi-popup-status" style={{ color: location.color, fontSize: '12px' }}>
                  {getAQILabel(location.aqi)}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

/**
 * Fetch AQI for a specific location from Windy API
 */
async function fetchLocationAQI(lat, lng) {
  console.log(`[fetchLocationAQI] Fetching for [${lat}, ${lng}]`);
  
  try {
    const apiKey = import.meta.env.VITE_WINDY_API_KEY;
    
    if (!apiKey) {
      console.warn('[fetchLocationAQI] VITE_WINDY_API_KEY not set. Get free key from https://windy.com/api');
      return 0;
    }

    // Windy API endpoint for point forecast with pollution data
    const url = new URL('https://api.windy.com/api/point-forecast/get');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lng.toString());
    url.searchParams.set('model', 'iconEu');  // High-res European model with pollution
    url.searchParams.set('parameters', 'pm10,pm25,no2,o3,so2');  // Request pollution parameters
    url.searchParams.set('timezoneOffset', '0');

    console.log(`[fetchLocationAQI] Requesting Windy API...`);
    
    const res = await fetch(url.toString());

    if (!res.ok) {
      console.warn(`[fetchLocationAQI] Windy API error: ${res.status}`);
      return 0;
    }

    const data = await res.json();
    console.log(`[fetchLocationAQI] Windy response:`, data);

    // Get the latest pollution data (first data point in the response)
    if (data.ts && data.ts.length > 0) {
      let pm25 = data['pm25']?.[0];  // PM2.5 (primary)
      let pm10 = data['pm10']?.[0];
      let no2 = data['no2']?.[0];
      let o3 = data['o3']?.[0];

      // Prefer PM2.5, fall back to PM10, then other pollutants
      if (pm25 && pm25 > 0) {
        const aqi = pm25ToAQI(pm25);
        console.log(`[fetchLocationAQI] Found PM2.5=${pm25}, AQI=${aqi}`);
        return aqi;
      }

      if (pm10 && pm10 > 0) {
        const aqi = estimateAQIFromPollutant('pm10', pm10);
        console.log(`[fetchLocationAQI] Found PM10=${pm10}, estimated AQI=${aqi}`);
        return aqi;
      }

      if (no2 && no2 > 0) {
        const aqi = estimateAQIFromPollutant('no2', no2);
        console.log(`[fetchLocationAQI] Found NO2=${no2}, estimated AQI=${aqi}`);
        return aqi;
      }

      if (o3 && o3 > 0) {
        const aqi = estimateAQIFromPollutant('o3', o3);
        console.log(`[fetchLocationAQI] Found O3=${o3}, estimated AQI=${aqi}`);
        return aqi;
      }
    }

    console.log(`[fetchLocationAQI] No pollution data in Windy response`);
    return 0;
  } catch (err) {
    console.error(`[fetchLocationAQI] Fatal error:`, err);
    return 0;
  }
}

/**
 * Official EPA PM2.5 → AQI formula
 */
function pm25ToAQI(pm25) {
  const breakpoints = [
    [0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];

  for (const [lo, hi, aqiLo, aqiHi] of breakpoints) {
    if (pm25 >= lo && pm25 <= hi) {
      return Math.round(((aqiHi - aqiLo) / (hi - lo)) * (pm25 - lo) + aqiLo);
    }
  }
  return 500;
}

/**
 * Estimate AQI from other pollutants if PM2.5 not available
 */
function estimateAQIFromPollutant(parameter, value) {
  // Rough conversion factors for other pollutants
  let estimatedPM25 = 0;

  switch (parameter) {
    case 'pm10':
      // PM10 to PM2.5 rough ratio
      estimatedPM25 = value * 0.4;
      break;
    case 'no2':
      // NO2 to PM2.5 equivalent (very rough)
      estimatedPM25 = value * 0.05;
      break;
    case 'o3':
      // O3 to PM2.5 equivalent (very rough)
      estimatedPM25 = value * 0.08;
      break;
    case 'so2':
      // SO2 to PM2.5 equivalent (very rough)
      estimatedPM25 = value * 0.06;
      break;
    default:
      return 0;
  }

  return pm25ToAQI(Math.min(estimatedPM25, 500));
}

/**
 * Get color based on AQI value
 */
function getAQIColor(aqi) {
  if (!aqi || aqi === 0) return '#60a5fa';
  if (aqi <= 50) return '#00e400'; // green
  if (aqi <= 100) return '#ffff00'; // yellow
  if (aqi <= 150) return '#ff7e00'; // orange
  if (aqi <= 200) return '#ff0000'; // red
  if (aqi <= 300) return '#8f3f97'; // purple
  return '#7e0023'; // dark red
}

/**
 * Get AQI status label
 */
function getAQILabel(aqi) {
  if (!aqi || aqi === 0) return 'No Data';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy†';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}
