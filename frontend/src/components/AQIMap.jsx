import React, { useState, useCallback, useEffect } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker,
  Popup, useMap, useMapEvents
} from "react-leaflet";
import AQIHeatmapLayer from "./AQIHeatmapLayer";
import PopularLocationsAQI from "./PopularLocationsAQI";
import WindLayer from "./WindLayer";
import TemperatureLayer from "./TemperatureLayer";
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
function AQIMap({ coordinates, aqiData, locationName, theme = 'dark' }) {
  const [offCenter, setOffCenter] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [baseMap, setBaseMap] = useState(theme === 'dark' ? 'Dark' : 'Map');
  const [waqiLayer, setWaqiLayer] = useState(false);

  // Sync baseMap with global theme toggle when user clicks the nav sun/moon
  useEffect(() => {
    setBaseMap(theme === 'dark' ? 'Dark' : 'Map');
  }, [theme]);
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

  const isDark = theme === 'dark';

  // Theme-adaptive styles for the white Google Maps controls
  const cardBg      = isDark ? 'rgba(30,30,30,0.97)'  : '#fff';
  const cardText    = isDark ? '#e8e8e8'               : '#3c4043';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.1)' : 'none';
  const cardShadow  = isDark
    ? '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)'
    : '0 2px 10px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.12)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : '#e8eaed';
  const mutedText    = isDark ? 'rgba(255,255,255,0.45)' : '#80868b';
  const activeItemBg = isDark ? 'rgba(56,189,248,0.18)'  : '#e8f0fe';
  const activeItemColor = isDark ? '#7dd3fc'              : '#1a73e8';
  const itemLabelColor  = isDark ? 'rgba(255,255,255,0.75)' : '#3c4043';

  return (
    <div className={`map-page-full map-theme-${theme}`}>

      {/* ── Floating header (theme-aware) ── */}
      <div className="map-floating-header" style={{ background: cardBg, boxShadow: cardShadow, border: `1px solid ${cardBorder}` }}>
        <div className="map-floating-title" style={{ color: cardText }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
          <span className="map-floating-title-text" style={{ color: cardText }}>
            Air Quality Map — <span style={{ color }}>{city}</span>
          </span>
        </div>
        <div className="map-floating-aqi" style={{ color, borderLeft: `1px solid ${dividerColor}` }}>
          AQI {aqi} · <span style={{ color: mutedText, fontWeight: 500 }}>{getAqiLabel(aqi)}</span>
        </div>
      </div>

      {/* ── Guide Card (theme-aware) ── */}
      <div className="map-guide-card" style={{ background: cardBg, boxShadow: cardShadow, border: `1px solid ${cardBorder}` }}>
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', color: mutedText, margin: '0 0 12px 0' }}>Data Overlays Guide</h4>
        <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e', display: 'block' }}>AQI Heatmap</span>
          <span style={{ fontSize: '11px', color: mutedText, marginTop: '2px', display: 'block' }}>Air pollution on a 0–300+ scale. Rendered from Open-Meteo free API.</span>
        </div>
        <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', display: 'block' }}>Wind Speed</span>
          <span style={{ fontSize: '11px', color: mutedText, marginTop: '2px', display: 'block' }}>Directional arrows show wind flow. High wind disperses pollution.</span>
        </div>
        <div style={{ lineHeight: '1.4' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#f97316', display: 'block' }}>Temperature</span>
          <span style={{ fontSize: '11px', color: mutedText, marginTop: '2px', display: 'block' }}>Colour blobs show local temperature. Warm air traps pollutants.</span>
        </div>
      </div>

      {/* ── Maps & Overlays button ── */}
      <button
        className={`map-layer-btn ${showLayerMenu ? 'active' : ''}`}
        style={{ position: 'absolute', bottom: '20px', right: '12px', zIndex: 1000, width: 'auto', padding: '9px 16px', background: cardBg, color: cardText, boxShadow: cardShadow, border: `1px solid ${cardBorder}` }}
        onClick={() => setShowLayerMenu(!showLayerMenu)}
        title="Maps &amp; Overlays"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        Maps &amp; Overlays
      </button>

      {/* ── Layer Menu Card (theme-aware) ── */}
      {showLayerMenu && (
        <div
          className="custom-layer-card"
          style={{
            position: 'absolute', bottom: '70px', right: '12px', zIndex: 1000,
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: '8px', boxShadow: cardShadow,
            padding: '16px 18px', minWidth: '220px',
            maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto', color: cardText,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid ${dividerColor}`, paddingBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', margin: 0, fontWeight: 700, letterSpacing: '0.3px', color: cardText }}>Map Layers</h4>
            <button onClick={() => setShowLayerMenu(false)} style={{ background: 'transparent', border: 'none', color: mutedText, cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Base Maps */}
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedText, marginBottom: '4px' }}>Base Map</div>
            {[
              { id: 'Map',       icon: 'map',                label: 'Street Map' },
              { id: 'Satellite', icon: 'satellite-in-orbit', label: 'Satellite'  },
              { id: 'Terrain',   icon: 'mountain',           label: 'Terrain'    },
              { id: 'Dark',      icon: 'partly-cloudy-night',label: 'Dark'       },
              { id: 'Light',     icon: 'sun',                label: 'Light'      },
            ].map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: baseMap === l.id ? activeItemBg : 'transparent' }}>
                <input type="radio" name="basemap" checked={baseMap === l.id} onChange={() => setBaseMap(l.id)}
                  style={{ accentColor: activeItemColor, width: '15px', height: '15px', cursor: 'pointer' }} />
                <img src={`https://img.icons8.com/fluency/48/${l.icon}.png`} width="18" height="18" alt={l.label} />
                <span style={{ fontSize: '13px', fontWeight: baseMap === l.id ? 600 : 400, color: baseMap === l.id ? activeItemColor : itemLabelColor }}>{l.label}</span>
              </label>
            ))}

            <hr style={{ border: 0, borderTop: `1px solid ${dividerColor}`, margin: '6px 0' }} />
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: mutedText, marginBottom: '4px' }}>Overlays</div>

            {[
              { id: 'heatmap', icon: 'heat-map',    label: 'AQI Heatmap',   state: showHeatMap, setter: setShowHeatMap },
              { id: 'cities',  icon: 'city',         label: 'City Markers',  state: showCities,  setter: setShowCities  },
              { id: 'waqi',    icon: 'air-quality',  label: 'Global AQI',    state: waqiLayer,   setter: setWaqiLayer   },
              { id: 'wind',    icon: 'wind',         label: 'Wind Speed',    state: windLayer,   setter: setWindLayer   },
              { id: 'temp',    icon: 'thermometer',  label: 'Temperature',   state: tempLayer,   setter: setTempLayer   },
            ].map(o => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', background: o.state ? activeItemBg : 'transparent' }}>
                <input type="checkbox" checked={o.state} onChange={e => o.setter(e.target.checked)}
                  style={{ accentColor: activeItemColor, width: '15px', height: '15px', cursor: 'pointer' }} />
                <img src={`https://img.icons8.com/fluency/48/${o.icon}.png`} width="18" height="18" alt={o.label} />
                <span style={{ fontSize: '13px', fontWeight: o.state ? 600 : 400, color: o.state ? activeItemColor : itemLabelColor }}>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── My Location button ── */}
      <button
        className={`map-recenter-btn ${offCenter ? 'visible' : ''}`}
        onClick={() => window.__mapFlyHome?.()}
        title="Fly back to my location"
        aria-label="Fly back to my location"
        style={{ background: cardBg, color: isDark ? '#7dd3fc' : '#1a73e8', boxShadow: cardShadow }}
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
        center={[lat, lon]} zoom={14} minZoom={3} maxZoom={20}
        worldCopyJump={true} maxBounds={[[-90, -Infinity], [90, Infinity]]}
        maxBoundsViscosity={1.0} scrollWheelZoom={true}
        zoomControl={false} attributionControl={false}
        doubleClickZoom={true} inertia={true}
        inertiaDeceleration={3000} inertiaMaxSpeed={2000} easeLinearity={0.2}
        className="leaflet-map-full"
      >
        {/* Base Layers */}
        {baseMap === 'Map'       && <TileLayer url="http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={20} />}
        {baseMap === 'Satellite' && <TileLayer url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={20} />}
        {baseMap === 'Terrain'   && <TileLayer url="http://mt0.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={20} />}
        {baseMap === 'Dark'      && <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" attribution="&copy; CartoDB" maxZoom={19} />}
        {baseMap === 'Light'     && <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" attribution="&copy; CartoDB" maxZoom={19} />}

        {/* Global AQI tile overlay (WAQI) */}
        {waqiLayer && <TileLayer url="https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=_TOKEN_" attribution="&copy; WAQI" opacity={0.7} zIndex={10} />}

        {/* Working overlays from Open-Meteo (free) */}
        <AQIHeatmapLayer show={showHeatMap} refreshKey={refreshKey} />
        <PopularLocationsAQI show={showCities} refreshKey={refreshKey} />
        <WindLayer show={windLayer} refreshKey={refreshKey} />
        <TemperatureLayer show={tempLayer} refreshKey={refreshKey} />

        {/* Controls */}
        <RecenterControl lat={lat} lon={lon} onOffCenter={() => setOffCenter(true)} onBackCenter={() => setOffCenter(false)} />
        <RefreshControl onRefresh={() => setRefreshKey(k => k + 1)} />
        <ZoomControls />

        {/* Location marker */}
        <Marker position={[lat, lon]} icon={pulseIcon}>
          <Popup className="aqi-popup">
            <div className="aqi-popup-inner">
              <div className="aqi-popup-city">
                <svg width="10" height="10" viewBox="0 0 24 24" fill={color} style={{ marginRight: 4 }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
                {city} Air Quality
              </div>
              <div className="aqi-popup-score" style={{ color }}>{aqi}</div>
              <div className="aqi-popup-status-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
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

      {/* Attribution */}
      <div className="map-attribution">Map data © <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google</a> | <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a></div>

      {/* Floating AQI Legend (theme-aware) */}
      <div className="map-floating-legend" style={{ background: cardBg, boxShadow: cardShadow, border: `1px solid ${cardBorder}` }}>
        <div className="legend-title" style={{ color: mutedText, borderBottom: `1px solid ${dividerColor}` }}>AQI Scale</div>
        {[
          { label: 'Good',          color: '#22c55e', range: '0–50'   },
          { label: 'Moderate',      color: '#eab308', range: '51–100' },
          { label: 'Unhealthy (SG)',color: '#f97316', range: '101–150'},
          { label: 'Unhealthy',     color: '#ef4444', range: '151–200'},
          { label: 'Very Unhealthy',  color: '#a855f7', range: '201–300'},
          { label: 'Hazardous',     color: '#dc2626', range: '301+'   },
        ].map(item => (
          <div key={item.label} className="legend-item">
            <span className="legend-dot" style={{ background: item.color }}/>
            <span className="legend-label" style={{ color: cardText }}>{item.label}</span>
            <span className="legend-range" style={{ color: mutedText }}>{item.range}</span>
          </div>
        ))}
        <div className="legend-current" style={{ borderTop: `1px solid ${dividerColor}` }}>
          <div className="legend-current-label" style={{ color: mutedText }}>Your AQI</div>
          <div className="legend-current-val" style={{ color }}>{aqi}</div>
          <div className="legend-current-status" style={{ color }}>{getAqiLabel(aqi)}</div>
        </div>
      </div>

    </div>
  );
}

export default AQIMap;



