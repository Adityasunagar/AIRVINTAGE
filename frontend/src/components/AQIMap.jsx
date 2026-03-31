import React, { useState, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker, CircleMarker,
  Popup, useMap, useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function getAqiColor(aqi) {
  if (!aqi) return "#60a5fa";
  if (aqi <= 50)  return "#22c55e";
  if (aqi <= 100) return "#eab308";
  if (aqi <= 150) return "#f97316";
  if (aqi <= 200) return "#ef4444";
  if (aqi <= 300) return "#a855f7";
  return "#dc2626";
}
function getAqiLabel(aqi) {
  if (!aqi)       return "No Data";
  if (aqi <= 50)  return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (Sensitive)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
function getNearbyMarkers(lat, lon, aqi) {
  return [
    { lat: lat + 0.4, lon: lon - 0.6, aqi: Math.max(10, aqi - 22), city: "North Zone" },
    { lat: lat - 0.5, lon: lon + 0.5, aqi: Math.min(300, aqi + 37), city: "East Zone"  },
    { lat: lat + 0.2, lon: lon + 0.8, aqi: Math.max(10, aqi - 10), city: "South Zone" },
    { lat: lat - 0.3, lon: lon - 0.7, aqi: Math.min(300, aqi + 15), city: "West Zone"  },
  ];
}

/* ─────────────────────────────────────────────
   Google-style pulsing "blue dot" DivIcon
───────────────────────────────────────────── */
function makePulseIcon(color) {
  return L.divIcon({
    className: "",
    iconSize:   [24, 24],
    iconAnchor: [12, 12],
    popupAnchor:[0, -14],
    html: `
      <div class="gm-dot-wrapper">
        <div class="gm-dot-pulse" style="background:${color}22;border-color:${color}44"></div>
        <div class="gm-dot-pulse gm-dot-pulse-2" style="background:${color}11;border-color:${color}33"></div>
        <div class="gm-dot-core" style="background:${color};box-shadow:0 0 0 3px ${color}55,0 2px 8px ${color}88"></div>
        <div class="gm-dot-inner"></div>
      </div>`,
  });
}

/* Zone bubble DivIcon */
function makeZoneIcon(color, aqi) {
  return L.divIcon({
    className: "",
    iconSize:   [48, 48],
    iconAnchor: [24, 24],
    popupAnchor:[0, -26],
    html: `
      <div class="gm-zone-bubble" style="background:${color};box-shadow:0 0 0 4px ${color}33,0 4px 16px ${color}66">
        <span class="gm-zone-aqi">${aqi}</span>
      </div>`,
  });
}

/* ─────────────────────────────────────────────
   Recenter / world-copy-aware fly-home
───────────────────────────────────────────── */
function RecenterControl({ lat, lon, onOffCenter, onBackCenter }) {
  const map = useMap();

  useMapEvents({
    moveend() {
      const c = map.getCenter();
      const lngDiff = ((c.lng - lon + 180) % 360 + 360) % 360 - 180;
      const dist = Math.hypot(c.lat - lat, lngDiff);
      dist > 0.15 ? onOffCenter() : onBackCenter();
    },
  });

  const flyHome = useCallback(() => {
    const wraps = Math.round((map.getCenter().lng - lon) / 360);
    map.flyTo([lat, lon + wraps * 360], 14, {
      duration: 1.4,
      easeLinearity: 0.2,
    });
  }, [map, lat, lon]);

  React.useEffect(() => {
    window.__mapFlyHome = flyHome;
    return () => { window.__mapFlyHome = null; };
  }, [flyHome]);

  return null;
}

/* ─────────────────────────────────────────────
   Custom Zoom Buttons (Google Maps style)
───────────────────────────────────────────── */
function ZoomControls() {
  const map = useMap();
  return (
    <div className="gm-zoom-controls">
      <button
        className="gm-zoom-btn"
        onClick={() => map.zoomIn()}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <div className="gm-zoom-divider"/>
      <button
        className="gm-zoom-btn"
        onClick={() => map.zoomOut()}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
function AQIMap({ coordinates, aqiData, locationName }) {
  const [offCenter, setOffCenter] = useState(false);

  if (!coordinates) return null;

  const lat    = parseFloat(coordinates.lat);
  const lon    = parseFloat(coordinates.lon);
  const aqi    = aqiData?.aqi || 0;
  const color  = getAqiColor(aqi);
  const city   = locationName?.city || "Your Location";
  const nearby = getNearbyMarkers(lat, lon, aqi);

  const pulseIcon = makePulseIcon(color);

  return (
    <div className="map-page-full">

      {/* ── Floating header ── */}
      <div className="map-floating-header">
        <div className="map-floating-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <span className="map-floating-title-text">
            Air Quality Map — <span style={{ color }}>{city}</span>
          </span>
        </div>
        <div className="map-floating-aqi" style={{ color }}>
          AQI {aqi} · <span style={{ color:"rgba(255,255,255,0.6)", fontWeight:500 }}>{getAqiLabel(aqi)}</span>
        </div>
      </div>

      {/* ── My Location recenter button ── */}
      <button
        className={`map-recenter-btn ${offCenter ? "visible" : ""}`}
        onClick={() => window.__mapFlyHome?.()}
        title="Fly back to my location"
        aria-label="Fly back to my location"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
        </svg>
        My Location
      </button>

      {/* ── Leaflet map ── */}
      <MapContainer
        center={[lat, lon]}
        zoom={14}
        minZoom={3}
        maxZoom={19}
        worldCopyJump={true}
        scrollWheelZoom={true}
        zoomControl={false}          /* we render our own */
        attributionControl={false}   /* we'll add slim attribution manually */
        doubleClickZoom={true}
        inertia={true}
        inertiaDeceleration={3000}
        inertiaMaxSpeed={2000}
        easeLinearity={0.2}
        className="leaflet-map-full"
      >
        {/* ── Tile layer — CartoDB dark (tested working) ── */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Logic */}
        <RecenterControl
          lat={lat} lon={lon}
          onOffCenter={() => setOffCenter(true)}
          onBackCenter={() => setOffCenter(false)}
        />

        {/* Custom zoom */}
        <ZoomControls />

        {/* ── Nearby zone bubbles ── */}
        {nearby.map((n) => {
          const nc = getAqiColor(n.aqi);
          return (
            <Marker
              key={n.city}
              position={[n.lat, n.lon]}
              icon={makeZoneIcon(nc, n.aqi)}
            >
              <Popup className="aqi-popup">
                <div className="aqi-popup-inner">
                  <div className="aqi-popup-city">{n.city}</div>
                  <div className="aqi-popup-score" style={{ color: nc }}>{n.aqi}</div>
                  <div className="aqi-popup-status">{getAqiLabel(n.aqi)}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Main pulsing location dot ── */}
        <Marker position={[lat, lon]} icon={pulseIcon}>
          <Popup className="aqi-popup">
            <div className="aqi-popup-inner">
              <div className="aqi-popup-city">
                <svg width="10" height="10" viewBox="0 0 24 24" fill={color} style={{ marginRight:4 }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
                {city} Air Quality
              </div>
              <div className="aqi-popup-score" style={{ color }}>{aqi}</div>
              <div className="aqi-popup-status-badge"
                style={{ background:`${color}22`, color, border:`1px solid ${color}55` }}>
                {aqiData?.status}
              </div>
              {aqiData && (
                <div className="aqi-popup-metrics">
                  <div className="popup-metric"><span className="popup-metric-val">{aqiData.pm2_5}</span><span className="popup-metric-lbl">PM2.5</span></div>
                  <div className="popup-metric"><span className="popup-metric-val">{aqiData.pm10}</span><span className="popup-metric-lbl">PM10</span></div>
                  <div className="popup-metric"><span className="popup-metric-val">{aqiData.nitrogen_dioxide}</span><span className="popup-metric-lbl">NO₂</span></div>
                  <div className="popup-metric"><span className="popup-metric-val">{aqiData.ozone}</span><span className="popup-metric-lbl">O₃</span></div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>

      </MapContainer>

      {/* ── Slim attribution ── */}
      <div className="map-attribution">© <a href="https://carto.com/" target="_blank" rel="noreferrer">CartoDB</a></div>

      {/* ── Floating legend ── */}
      <div className="map-floating-legend">
        <div className="legend-title">AQI Scale</div>
        {[
          { label:"Good",           color:"#22c55e", range:"0–50"   },
          { label:"Moderate",       color:"#eab308", range:"51–100" },
          { label:"Unhealthy†",     color:"#f97316", range:"101–150"},
          { label:"Unhealthy",      color:"#ef4444", range:"151–200"},
          { label:"Very Unhealthy", color:"#a855f7", range:"201–300"},
          { label:"Hazardous",      color:"#dc2626", range:"301+"   },
        ].map((item) => (
          <div key={item.label} className="legend-item">
            <span className="legend-dot" style={{ background:item.color }}/>
            <span className="legend-label">{item.label}</span>
            <span className="legend-range">{item.range}</span>
          </div>
        ))}
        <div className="legend-current">
          <div className="legend-current-label">Your AQI</div>
          <div className="legend-current-val" style={{ color }}>{aqi}</div>
          <div className="legend-current-status" style={{ color }}>{getAqiLabel(aqi)}</div>
        </div>
      </div>

    </div>
  );
}

export default AQIMap;
