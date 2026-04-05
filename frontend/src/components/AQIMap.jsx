import React, { useState, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker,
  Popup, useMap, useMapEvents
} from "react-leaflet";
import AQIHeatmapLayer from "./AQIHeatmapLayer";
import PopularLocationsAQI from "./PopularLocationsAQI";
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
   Custom Map Controls (Refresh, Zoom)
───────────────────────────────────────────── */
function RefreshControl({ onRefresh }) {
  return (
    <div className="gm-refresh-control">
      <button
        className="gm-zoom-btn"
        onClick={(e) => {
          e.preventDefault();
          onRefresh();
        }}
        title="Refresh Map & Data"
        aria-label="Refresh Map & Data"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    </div>
  );
}

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
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Custom Layer Control States
  const [baseMap, setBaseMap] = useState("Map");
  const [waqiLayer, setWaqiLayer] = useState(false);
  const [windLayer, setWindLayer] = useState(false);
  const [tempLayer, setTempLayer] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  if (!coordinates) return null;

  const lat    = parseFloat(coordinates.lat);
  const lon    = parseFloat(coordinates.lon);
  const aqi    = aqiData?.aqi || 0;
  const color  = getAqiColor(aqi);
  const city   = locationName?.city || "Your Location";

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

      {/* ── Environment Guide Overlay (Top Left) ── */}
      <div className="map-guide-card">
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', margin: '0 0 12px 0' }}>Data Overlays Guide</h4>
        
        <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#10b981', display: 'block' }}>AQI Index</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block' }}>Measures air pollution on a scale of 0 (Good) to 300+ (Hazardous). Base layer for health risk.</span>
        </div>
        
        <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', display: 'block' }}>Wind Speed & Direction</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block' }}>Dictates smog travel. High winds disperse pollution; stagnant air keeps it trapped and raises AQI.</span>
        </div>

        <div style={{ lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#f59e0b', display: 'block' }}>Temperature Inversion</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', display: 'block' }}>Unusually warm air creates a "lid" near the surface, acting as a blanket that traps toxic pollutants.</span>
        </div>
      </div>



      {/* ── New Mobile-Friendly Maps & Layers Button (Bottom Right) ── */}
      <button
        className={`map-layer-btn ${showLayerMenu ? 'active' : ''}`}
        style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, width: 'auto', padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        onClick={() => setShowLayerMenu(!showLayerMenu)}
        title="Maps & Overlays"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        Maps & Overlays
      </button>

      {/* ── Custom React Layer Menu Card (Responsive, fixed "hover" issue) ── */}
      {showLayerMenu && (
        <div 
          className="custom-layer-card" 
          style={{
            position: 'absolute',
            bottom: '75px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(10, 15, 30, 0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            padding: '16px 18px',
            minWidth: '220px',
            maxWidth: 'calc(100vw - 40px)',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            color: '#fff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', margin: 0, fontWeight: 700, letterSpacing: '0.5px' }}>Map Layers</h4>
            <button onClick={() => setShowLayerMenu(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Base Maps */}
            {[
              { id: 'Map', icon: 'map', label: 'Street Map' },
              { id: 'Satellite', icon: 'satellite-in-orbit', label: 'Satellite' },
              { id: 'Terrain', icon: 'mountain', label: 'Terrain' },
              { id: 'Dark', icon: 'partly-cloudy-night', label: 'Dark Mode' },
              { id: 'Light', icon: 'sun', label: 'Light Mode' }
            ].map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', outline: 'none', transition: '0.2s', padding: '4px', borderRadius: '8px', background: baseMap === l.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent' }}>
                <input 
                  type="radio" 
                  name="basemap" 
                  checked={baseMap === l.id} 
                  onChange={() => setBaseMap(l.id)} 
                  style={{ accentColor: '#38bdf8', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <img src={`https://img.icons8.com/fluency/48/${l.icon}.png`} width="20" height="20" alt={l.label} />
                <span style={{ fontSize: '13px', fontWeight: baseMap === l.id ? 600 : 400, color: baseMap === l.id ? '#fff' : 'rgba(255,255,255,0.7)' }}>{l.label}</span>
              </label>
            ))}

            <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 0' }} />

            {/* Overlays */}
            {[
              { id: 'heatmap', icon: 'heat-map', label: 'Windy Heatmap', state: showHeatMap, setter: setShowHeatMap, color: '#f43f5e' },
              { id: 'cities', icon: 'city', label: 'City Markers', state: showCities, setter: setShowCities, color: '#a855f7' },
              { id: 'waqi', icon: 'air-quality', label: 'Global AQI', state: waqiLayer, setter: setWaqiLayer, color: '#10b981' },
              { id: 'wind', icon: 'wind', label: 'Wind Speed', state: windLayer, setter: setWindLayer, color: '#38bdf8' },
              { id: 'temp', icon: 'thermometer', label: 'Temperature', state: tempLayer, setter: setTempLayer, color: '#f59e0b' }
            ].map(o => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: '0.2s', padding: '4px', borderRadius: '8px', background: o.state ? `rgba(255,255,255,0.08)` : 'transparent' }}>
                <input 
                  type="checkbox" 
                  checked={o.state} 
                  onChange={(e) => o.setter(e.target.checked)} 
                  style={{ accentColor: o.color, width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <img src={`https://img.icons8.com/fluency/48/${o.icon}.png`} width="20" height="20" alt={o.label} />
                <span style={{ fontSize: '13px', fontWeight: o.state ? 600 : 400, color: o.state ? '#fff' : 'rgba(255,255,255,0.7)' }}>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
        maxBounds={[[-90, -Infinity], [90, Infinity]]}
        maxBoundsViscosity={1.0}
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
        {/* ── Custom React State Layers (Replaces Leaflet LayersControl)  ── */}
        
        {/* Base Layers */}
        {baseMap === 'Map' && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19} maxNativeZoom={19} />}
        {baseMap === 'Satellite' && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; <a href="https://www.esri.com/">Esri</a>' maxZoom={19} maxNativeZoom={18} />}
        {baseMap === 'Terrain' && <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" attribution='&copy; OpenTopoMap' maxZoom={19} maxNativeZoom={17} />}
        {baseMap === 'Dark' && <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" attribution='&copy; CartoDB' maxZoom={19} maxNativeZoom={19} />}
        {baseMap === 'Light' && <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" attribution='&copy; CartoDB' maxZoom={19} maxNativeZoom={19} />}

        {/* Overlays */}
        {waqiLayer && <TileLayer url="https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=YOUR_WAQI_TOKEN_HERE" attribution="&copy; WAQI" opacity={0.8} zIndex={10} />}
        {windLayer && <TileLayer url="https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY_HERE" attribution="&copy; OpenWeatherMap" opacity={0.7} zIndex={11} />}
        {tempLayer && <TileLayer url="https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=YOUR_OWM_API_KEY_HERE" attribution="&copy; OpenWeatherMap" opacity={0.6} zIndex={12} />}

        {/* Logic */}
        <RecenterControl
          lat={lat} lon={lon}
          onOffCenter={() => setOffCenter(true)}
          onBackCenter={() => setOffCenter(false)}
        />

        {/* Custom Controls */}
        <RefreshControl onRefresh={() => setRefreshKey(k => k + 1)} />
        <ZoomControls />

        {/* ── MSN Weather-style AQI Heat Map ── */}
        <AQIHeatmapLayer show={showHeatMap} refreshKey={refreshKey} />

        {/* ── Popular Cities AQI Markers ── */}
        <PopularLocationsAQI show={showCities} refreshKey={refreshKey} />

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
      <div className="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | <a href="https://windy.com" target="_blank" rel="noreferrer">Windy</a> for Air Quality</div>

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
