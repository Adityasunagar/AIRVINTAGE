import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import HeatmapOverlay from 'leaflet-heatmap';

const AQI_GRADIENT = {
  0.0: '#00e400',
  0.3: '#ffff00',
  0.5: '#ff7e00',
  0.7: '#ff0000',
  0.9: '#8f3f97',
  1.0: '#7e0023',
};

const HEATMAP_CONFIG = {
  radius: 40,
  maxOpacity: 0.72,
  scaleRadius: false,
  useLocalExtrema: false,
  latField: 'lat',
  lngField: 'lng',
  valueField: 'aqi',
  gradient: AQI_GRADIENT,
  blur: 0.85,
};

const AQI_MAX = 300;

// Small random jitter to break the rigid grid pattern and produce natural-looking blobs
const jitter = () => (Math.random() - 0.5) * 0.05;

async function fetchAQIPoints(bounds) {
  const { _southWest: sw, _northEast: ne } = bounds;
  
  // 1. Calculate max span to determine an absolute grid step size
  const latDiff = ne.lat - sw.lat;
  const lngDiff = ne.lng - sw.lng;
  const maxDiff = Math.max(latDiff, lngDiff);
  
  // 2. We want roughly 8 steps across the largest dimension.
  const rawStep = maxDiff / 8;
  
  // 3. Quantize the step to round numbers (0.1, 0.2, 0.5, 1, 2, 5, etc.) so it locks to a global grid
  const order = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / order;
  let qStep;
  if (norm < 1.5) qStep = 1;
  else if (norm < 3.5) qStep = 2;
  else if (norm < 7.5) qStep = 5;
  else qStep = 10;
  const step = Math.max(0.01, qStep * order); // prevent zero step

  // 4. Snap the bounds to the absolute step size
  const startLat = Math.floor(sw.lat / step) * step;
  const endLat = Math.ceil(ne.lat / step) * step;
  const startLng = Math.floor(sw.lng / step) * step;
  const endLng = Math.ceil(ne.lng / step) * step;

  const lats = [];
  const lngs = [];

  for (let lat = startLat; lat <= endLat; lat += step) {
    for (let lng = startLng; lng <= endLng; lng += step) {
      // Add jitter so points don't perfectly align on a visible grid
      lats.push(Math.min(Math.max(lat + jitter() * step, -90), 90).toFixed(4));
      lngs.push(Math.min(Math.max(lng + jitter() * step, -180), 180).toFixed(4));
      if (lats.length >= 100) break; // Hard limit for Open-Meteo free API
    }
    if (lats.length >= 100) break;
  }

  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats.join(',')}&longitude=${lngs.join(',')}&current=us_aqi&timezone=auto`);
    if (!res.ok) return [];
    
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((d, index) => {
      const aqi = d?.current?.us_aqi ?? 0;
      return aqi > 0 ? { lat: parseFloat(lats[index]), lng: parseFloat(lngs[index]), aqi } : null;
    }).filter(Boolean);
  } catch (e) {
    console.error("Heatmap fetch error", e);
    return [];
  }
}

export default function AQIHeatmapLayer({ show = true, refreshKey = 0 }) {
  const map = useMap();
  const overlayRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && show) {
      overlayRef.current = new HeatmapOverlay(HEATMAP_CONFIG);
      overlayRef.current.addTo(map);
      initializedRef.current = true;
    }

    if (!show && overlayRef.current && map.hasLayer(overlayRef.current)) {
      map.removeLayer(overlayRef.current);
    }

    async function fetchAndRender() {
      if (!show || !overlayRef.current) return;
      if (!map.hasLayer(overlayRef.current)) {
        overlayRef.current.addTo(map);
      }
      const points = await fetchAQIPoints(map.getBounds());
      // Handle possibility that show went false during fetch
      if (!map.hasLayer(overlayRef.current)) return;
      overlayRef.current.setData({ max: AQI_MAX, data: points });
    }

    if (show) {
      fetchAndRender();
      map.on('moveend', fetchAndRender);
    }

    return () => {
      map.off('moveend', fetchAndRender);
      if (overlayRef.current && map.hasLayer(overlayRef.current)) {
        map.removeLayer(overlayRef.current);
      }
      initializedRef.current = false;
    };
  }, [map, show, refreshKey]);

  return null;
}
