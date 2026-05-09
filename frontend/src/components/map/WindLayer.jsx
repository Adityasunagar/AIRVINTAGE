import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

export default function WindLayer({ show = true, refreshKey = 0 }) {
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
      
      const rawStep = maxDiff / 6; // slightly sparser for wind arrows
      
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
             speed: d?.current_weather?.windspeed ?? 0,
             dir: d?.current_weather?.winddirection ?? 0,
          }));
        }
      } catch (e) {
        console.error("Wind fetch error", e);
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
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('width', size.x);
      svg.setAttribute('height', size.y);

      for (const pt of points) {
        if (!pt.speed) continue;
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
        line.setAttribute('marker-end', 'url(#wind-arrow)');
        svg.appendChild(line);

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', px.x);
        circle.setAttribute('cy', px.y);
        circle.setAttribute('r', 3 + intensity * 4);
        circle.setAttribute('fill', arrowColor);
        circle.setAttribute('fill-opacity', 0.6);
        svg.appendChild(circle);
      }

      const defs = document.createElementNS(svgNS, 'defs');
      const marker = document.createElementNS(svgNS, 'marker');
      marker.setAttribute('id', 'wind-arrow');
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

      const container = document.createElement('div');
      container.className = 'leaflet-wind-layer leaflet-zoom-hide';
      container.style.cssText = `position:absolute;top:${nw.y}px;left:${nw.x}px;pointer-events:none;z-index:500;`;
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
