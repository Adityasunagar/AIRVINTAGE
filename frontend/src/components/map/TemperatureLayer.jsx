import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

// Map temperature (°C) to a colour via a blue → green → yellow → red gradient
function tempToColor(t) {
  if (t <= 0)  return [0, 120, 255];     // deep blue (freezing)
  if (t <= 10) return [100, 180, 255];   // light blue (cold)
  if (t <= 18) return [0, 210, 140];     // teal-green (cool)
  if (t <= 24) return [100, 220, 50];    // green (comfortable)
  if (t <= 30) return [255, 220, 0];     // yellow (warm)
  if (t <= 36) return [255, 140, 0];     // orange (hot)
  return [220, 30, 30];                   // red (extreme)
}

export default function TemperatureLayer({ show = true, refreshKey = 0 }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!show) {
      if (layerRef.current && layerRef.current.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
      }
      layerRef.current = null;
      return;
    }

    async function fetchAndDraw() {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const latDiff = ne.lat - sw.lat;
      const lngDiff = ne.lng - sw.lng;
      const maxDiff = Math.max(latDiff, lngDiff);
      
      const rawStep = maxDiff / 6;
      
      const order = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const norm = rawStep / order;
      let qStep;
      if (norm < 1.5) qStep = 1;
      else if (norm < 3.5) qStep = 2;
      else if (norm < 7.5) qStep = 5;
      else qStep = 10;
      const step = Math.max(0.01, qStep * order);

      const startLat = Math.floor(sw.lat / step) * step;
      const endLat = Math.ceil(ne.lat / step) * step;
      const startLng = Math.floor(sw.lng / step) * step;
      const endLng = Math.ceil(ne.lng / step) * step;

      const lats = [];
      const lngs = [];
      for (let lat = startLat; lat <= endLat; lat += step) {
        for (let lng = startLng; lng <= endLng; lng += step) {
          lats.push(lat.toFixed(3));
          lngs.push(lng.toFixed(3));
          if (lats.length >= 100) break;
        }
        if (lats.length >= 100) break;
      }

      let points = [];
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lngs.join(',')}&current_weather=true`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [data];
          points = arr.map((d, idx) => ({
            lat: parseFloat(lats[idx]),
            lng: parseFloat(lngs[idx]),
            temp: d?.current_weather?.temperature ?? null,
          })).filter(p => p.temp !== null);
        }
      } catch (e) {
        console.error("Temperature fetch error", e);
      }

      if (layerRef.current && layerRef.current.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
        layerRef.current = null;
      }
      
      if (!show) return;

      const size = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', size.x);
      svg.setAttribute('height', size.y);

      for (const pt of points) {
        const px = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const [r, g, b] = tempToColor(pt.temp);

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', px.x);
        circle.setAttribute('cy', px.y);
        circle.setAttribute('r', 28);
        circle.setAttribute('fill', `rgba(${r},${g},${b},0.38)`);
        svg.appendChild(circle);

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', px.x);
        text.setAttribute('y', px.y + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        text.setAttribute('text-shadow', '0 1px 2px rgba(0,0,0,0.5)');
        text.textContent = `${Math.round(pt.temp)}°`;
        svg.appendChild(text);
      }

      const container = document.createElement('div');
      container.className = 'leaflet-temperature-layer leaflet-zoom-hide';
      container.style.cssText = `position:absolute;top:${nw.y}px;left:${nw.x}px;pointer-events:none;z-index:400;`;
      container.appendChild(svg);

      const pane = map.getPanes().overlayPane;
      pane.appendChild(container);
      layerRef.current = container;
    }

    fetchAndDraw();
    map.on('moveend', fetchAndDraw);

    return () => {
      map.off('moveend', fetchAndDraw);
      if (layerRef.current && layerRef.current.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
      }
      layerRef.current = null;
    };
  }, [map, show, refreshKey]);

  return null;
}
