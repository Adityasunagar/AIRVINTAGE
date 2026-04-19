import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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
      if (layerRef.current?.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
      }
      layerRef.current = null;
      return;
    }

    async function fetchAndDraw() {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const STEPS = 6;
      const latStep = (ne.lat - sw.lat) / STEPS;
      const lngStep = (ne.lng - sw.lng) / STEPS;

      const requests = [];
      for (let i = 0; i <= STEPS; i++) {
        for (let j = 0; j <= STEPS; j++) {
          const lat = sw.lat + i * latStep;
          const lng = sw.lng + j * lngStep;
          requests.push(
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current_weather=true&timezone=auto`
            )
              .then((r) => r.json())
              .then((d) => ({
                lat,
                lng,
                temp: d?.current_weather?.temperature ?? null,
              }))
              .catch(() => null)
          );
        }
      }

      const points = (await Promise.all(requests)).filter((p) => p && p.temp !== null);

      // Remove old overlay
      if (layerRef.current?.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
        layerRef.current = null;
      }

      const svgNS = 'http://www.w3.org/2000/svg';
      const pxBounds = map.getPixelBounds();
      const size = pxBounds.max.subtract(pxBounds.min);

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', size.x);
      svg.setAttribute('height', size.y);
      svg.style.position = 'absolute';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = 400;

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
      container.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
      container.appendChild(svg);

      const pane = map.getPanes().overlayPane;
      pane.appendChild(container);
      layerRef.current = container;
    }

    fetchAndDraw();
    map.on('moveend', fetchAndDraw);

    return () => {
      map.off('moveend', fetchAndDraw);
      if (layerRef.current?.parentNode) {
        layerRef.current.parentNode.removeChild(layerRef.current);
      }
    };
  }, [map, show, refreshKey]);

  return null;
}
