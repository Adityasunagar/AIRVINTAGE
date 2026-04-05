import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import HeatmapOverlay from 'leaflet-heatmap';

// MSN Weather-style AQI gradient
const AQI_GRADIENT = {
  0.00: '#00e400', // Good        (0–50)
  0.17: '#ffff00', // Moderate    (51–100)
  0.34: '#ff7e00', // USG         (101–150)
  0.50: '#ff0000', // Unhealthy   (151–200)
  0.67: '#8f3f97', // Very Unhealthy (201–300)
  0.84: '#7e0023', // Hazardous   (301+)
  1.00: '#4b0000', // Extreme
};

const HEATMAP_CONFIG = {
  radius: 60,          // Large radius so blobs merge into zones
  maxOpacity: 0.80,    // Slightly transparent like MSN
  scaleRadius: false,
  useLocalExtrema: false,
  latField: 'lat',
  lngField: 'lng',
  valueField: 'aqi',
  gradient: AQI_GRADIENT,
  blur: 0.85,          // High blur = smooth transitions between zones
};

const AQI_MAX = 300; // Normalize against this

export default function AQIHeatmapLayer({ show = true, refreshKey = 0 }) {
  const map = useMap();
  const overlayRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Initialize heatmap overlay once
    if (!isInitializedRef.current && show) {
      overlayRef.current = new HeatmapOverlay(HEATMAP_CONFIG);
      overlayRef.current.addTo(map);
      isInitializedRef.current = true;
    }

    if (!show && overlayRef.current && map.hasLayer(overlayRef.current)) {
      map.removeLayer(overlayRef.current);
      return;
    }

    async function fetchAndRender() {
      if (!show || !overlayRef.current) return;

      const bounds = map.getBounds();
      const points = await fetchAQIPoints(bounds);

      overlayRef.current.setData({
        max: AQI_MAX,
        data: points,
      });
    }

    if (show) {
      fetchAndRender();
      map.on('moveend', fetchAndRender);
    }

    return () => {
      map.off('moveend', fetchAndRender);
    };
  }, [map, show, refreshKey]);

  return null;
}

// Fetch AQI from Windy across a grid within map bounds
async function fetchAQIPoints(bounds) {
  const { _southWest: sw, _northEast: ne } = bounds;

  try {
    const apiKey = import.meta.env.VITE_WINDY_API_KEY;
    
    if (!apiKey) {
      console.warn('[AQIHeatmapLayer] VITE_WINDY_API_KEY not set');
      return [];
    }

    // Create a denser grid for better heatmap coverage
    const latStep = (ne.lat - sw.lat) / 5;  // 6 rows
    const lngStep = (ne.lng - sw.lng) / 5;  // 6 columns
    
    const points = [];
    const requests = [];

    // Create fetch requests for a 6x6 grid
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const lat = sw.lat + (i + 0.5) * latStep;
        const lng = sw.lng + (j + 0.5) * lngStep;

        const url = new URL('https://api.windy.com/api/point-forecast/get');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('lat', lat.toString());
        url.searchParams.set('lon', lng.toString());
        url.searchParams.set('model', 'iconEu');
        url.searchParams.set('parameters', 'pm10,pm25');
        url.searchParams.set('timezoneOffset', '0');

        requests.push(
          fetch(url.toString())
            .then(res => res.json())
            .then(data => {
              // Extract PM2.5 or PM10 from latest data point
              let aqi = 0;
              if (data.ts && data.ts.length > 0) {
                const pm25 = data['pm25']?.[0];
                const pm10 = data['pm10']?.[0];
                
                if (pm25 && pm25 > 0) {
                  aqi = pm25ToAQI(pm25);
                } else if (pm10 && pm10 > 0) {
                  aqi = pm25ToAQI(pm10 * 0.4); // Rough PM10 -> PM2.5 conversion
                }
              }
              
              if (aqi > 0) {
                points.push({ lat, lng, aqi });
              }
              return null;
            })
            .catch(err => console.warn(`Windy fetch failed for [${lat},${lng}]:`, err))
        );
      }
    }

    // Wait for all requests to complete
    await Promise.all(requests);
    
    console.log(`[AQIHeatmapLayer] Fetched ${points.length} heatmap points`);
    return points;
  } catch (err) {
    console.error('[AQIHeatmapLayer] Windy fetch failed:', err);
    return [];
  }
}

// Official EPA PM2.5 → AQI formula
function pm25ToAQI(pm25) {
  const breakpoints = [
    [0,    12.0,  0,   50],
    [12.1, 35.4,  51,  100],
    [35.5, 55.4,  101, 150],
    [55.5, 150.4, 151, 200],
    [150.5,250.4, 201, 300],
    [250.5,350.4, 301, 400],
    [350.5,500.4, 401, 500],
  ];

  for (const [lo, hi, aqiLo, aqiHi] of breakpoints) {
    if (pm25 >= lo && pm25 <= hi) {
      return Math.round(((aqiHi - aqiLo) / (hi - lo)) * (pm25 - lo) + aqiLo);
    }
  }
  return 500;
}
