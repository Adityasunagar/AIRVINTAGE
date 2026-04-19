import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Renders a wind speed overlay by sampling a grid from Open-Meteo
 * and drawing directional arrows on a Leaflet canvas layer.
 */
export default function WindLayer({ show = true, refreshKey = 0 }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!show) {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
      return;
    }

    async function fetchAndDraw() {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const STEPS = 5;
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
                speed: d?.current_weather?.windspeed ?? 0,
                dir: d?.current_weather?.winddirection ?? 0,
              }))
              .catch(() => null)
          );
        }
      }

      const points = (await Promise.all(requests)).filter(Boolean);

      // Remove old layer
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }

      // Build SVG overlay
      const pxBounds = map.getPixelBounds();
      const topLeft = pxBounds.min;
      const size = pxBounds.max.subtract(pxBounds.min);

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('width', size.x);
      svg.setAttribute('height', size.y);
      svg.style.position = 'absolute';
      svg.style.pointerEvents = 'none';

      for (const pt of points) {
        const px = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const maxSpeed = 60; // km/h cap
        const intensity = Math.min(pt.speed / maxSpeed, 1);
        const r = Math.round(intensity * 255);
        const b = Math.round((1 - intensity) * 255);
        const arrowColor = `rgb(${r},80,${b})`;

        const rad = ((pt.dir - 90) * Math.PI) / 180;
        const len = 12 + intensity * 16;
        const x2 = px.x + Math.cos(rad) * len;
        const y2 = px.y + Math.sin(rad) * len;

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', px.x);
        line.setAttribute('y1', px.y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', arrowColor);
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-opacity', '0.8');
        line.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(line);

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', px.x);
        circle.setAttribute('cy', px.y);
        circle.setAttribute('r', 3 + intensity * 4);
        circle.setAttribute('fill', arrowColor);
        circle.setAttribute('fill-opacity', 0.6);
        svg.appendChild(circle);
      }

      // Arrow marker def
      const defs = document.createElementNS(svgNS, 'defs');
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', 'arrow');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('refX', '6');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M0 0 L0 6 L6 3 z');
      path.setAttribute('fill', '#ef4444');
      marker.appendChild(path);
      defs.appendChild(marker);
      svg.insertBefore(defs, svg.firstChild);

      const container = L.DomUtil.create('div', 'leaflet-wind-layer');
      container.style.position = 'absolute';
      container.style.left = '0';
      container.style.top = '0';
      container.style.pointerEvents = 'none';
      container.style.zIndex = 500;
      container.appendChild(svg);

      const pane = map.getPanes().overlayPane;
      pane.appendChild(container);
      layerRef.current = { _container: container };
      layerRef.current.removeFrom = () => pane.removeChild(container);
    }

    fetchAndDraw();
    map.on('moveend', fetchAndDraw);

    return () => {
      map.off('moveend', fetchAndDraw);
      if (layerRef.current?._container?.parentNode) {
        layerRef.current._container.parentNode.removeChild(layerRef.current._container);
      }
    };
  }, [map, show, refreshKey]);

  return null;
}
