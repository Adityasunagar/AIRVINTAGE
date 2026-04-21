import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import HeatmapOverlay from 'leaflet-heatmap';

const AQI_GRADIENT = {
  0.00: '#00e400',
  0.17: '#ffff00',
  0.34: '#ff7e00',
  0.50: '#ff0000',
  0.67: '#8f3f97',
  0.84: '#7e0023',
  1.00: '#4b0000',
};

const HEATMAP_CONFIG = {
  radius: 80,
  maxOpacity: 0.75,
  scaleRadius: false,
  useLocalExtrema: false,
  latField: 'lat',
  lngField: 'lng',
  valueField: 'aqi',
  gradient: AQI_GRADIENT,
  blur: 0.95,
};

const AQI_MAX = 300;

async function fetchAQIPoints(bounds) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const STEPS = 6; // 7x7 grid = 49 points for better heatmap blending
  const latStep = (ne.lat - sw.lat) / STEPS;
  const lngStep = (ne.lng - sw.lng) / STEPS;

  const lats = [];
  const lngs = [];

  for (let i = 0; i <= STEPS; i++) {
    for (let j = 0; j <= STEPS; j++) {
      lats.push((sw.lat + i * latStep).toFixed(4));
      lngs.push((sw.lng + j * lngStep).toFixed(4));
    }
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
