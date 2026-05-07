import React, { useState, useCallback, useEffect } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker,
  Popup, useMap, useMapEvents
} from "react-leaflet";
import PopularLocationsAQI from "./PopularLocationsAQI";
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
   FlyToOnMount — fixes react-leaflet’s non-reactive center prop.
   MapContainer.center is set ONCE at mount and never updates when
   coordinates change. This component flies to the correct position
   whenever lat/lon props change.
───────────────────────────────────────────── */
function FlyToOnMount({ lat, lon }) {
  const map = useMap();
  React.useEffect(() => {
    if (lat !== null && lon !== null) {
      map.flyTo([lat, lon], 14, { duration: 1.2, easeLinearity: 0.25 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);
  return null;
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
   Map Click Handler for AQI Popup
───────────────────────────────────────────── */
function ClickMapEvent({ setPopupData }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      setPopupData({ lat, lng, loading: true });
      try {
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setPopupData({
          lat, lng, loading: false,
          aqi: data.current.us_aqi,
          pm25: data.current.pm2_5
        });
      } catch (err) {
        setPopupData({ lat, lng, loading: false, error: true });
      }
    }
  });
  return null;
}

/* ─────────────────────────────────────────────
   Legend Auto-Collapse Handler
───────────────────────────────────────────── */
function LegendCollapseHandler({ legendOpen, setLegendOpen }) {
  useMapEvents({
    movestart() {
      if (legendOpen) setLegendOpen(false);
    }
  });
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
  const [showCities, setShowCities] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);

  const [baseMap, setBaseMap] = useState('Dark');
  const [waqiLayer, setWaqiLayer] = useState(false);

  // Sync baseMap with global theme toggle when user clicks the nav sun/moon
  useEffect(() => {
    setBaseMap(theme === 'dark' ? 'Dark' : 'Map');
  }, [theme]);
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

      {/* ── Collapsible Legend Pill (Left Panel) ── */}
      <div className={`map-legend-container ${legendOpen ? 'open' : ''}`}>
        {!legendOpen ? (
          <button className="map-legend-pill glassmorphism-dark" onClick={() => setLegendOpen(true)}>
            <span style={{ marginRight: '6px' }}>ℹ️</span> Legend
          </button>
        ) : (
          <div className="map-legend-card glassmorphism-dark">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', color: '#e8e8e8' }}>AQI LEGEND</span>
              <button onClick={() => setLegendOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            
            <div className="legend-current" style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase' }}>Your AQI</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{aqi} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>· {getAqiLabel(aqi)}</span></div>
            </div>

            <div className="legend-scale">
              {[
                { label: 'Good',          color: '#00e400' },
                { label: 'Moderate',      color: '#ffff00' },
                { label: 'Unhealthy (SG)',color: '#ff7e00' },
                { label: 'Unhealthy',     color: '#ff0000' },
                { label: 'Very Unhealthy',color: '#8f3f97' },
                { label: 'Hazardous',     color: '#7e2222' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px', color: '#e8e8e8' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Maps & Overlays button ── */}
      <button
        className={`map-layer-btn ${showLayerMenu ? 'active' : ''} glassmorphism-dark`}
        style={{ position: 'absolute', bottom: '80px', right: '12px', zIndex: 1000, width: 'auto', padding: '9px 12px', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={() => setShowLayerMenu(!showLayerMenu)}
        title="Maps &amp; Overlays"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>

      {/* ── Layer Menu Card (Slide-In) ── */}
      <div className={`custom-layer-card glassmorphism-dark ${showLayerMenu ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: '10px' }}>
          <h4 style={{ fontSize: '14px', margin: 0, fontWeight: 700, letterSpacing: '0.3px', color: '#e8e8e8' }}>Map Layers</h4>
          <button onClick={() => setShowLayerMenu(false)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Base Maps */}
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '4px' }}>Base Map</div>
            {[
              { id: 'Map',       icon: 'map',                label: 'Street Map' },
              { id: 'Satellite', icon: 'satellite-in-orbit', label: 'Satellite'  },
              { id: 'Terrain',   icon: 'mountain',           label: 'Terrain'    },
              { id: 'Dark',      icon: 'partly-cloudy-night',label: 'Dark'       },
              { id: 'Light',     icon: 'sun',                label: 'Light'      },
            ].map(l => (
              <label key={l.id} className="layer-option">
                <input type="radio" name="basemap" checked={baseMap === l.id} onChange={() => setBaseMap(l.id)} />
                <img src={`https://img.icons8.com/fluency/48/${l.icon}.png`} width="18" height="18" alt={l.label} />
                <span>{l.label}</span>
              </label>
            ))}

            <hr style={{ border: 0, borderTop: `1px solid rgba(255,255,255,0.1)`, margin: '6px 0' }} />
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '4px' }}>Overlays</div>

            {[
              { id: 'cities',  icon: 'city',        label: 'City Markers',  state: showCities,  setter: setShowCities  },
              { id: 'waqi',    icon: 'air-quality', label: 'Global AQI',    state: waqiLayer,   setter: setWaqiLayer   },
              { id: 'temp',    icon: 'thermometer', label: 'Temperature',   state: tempLayer,   setter: setTempLayer   },
            ].map(o => (
              <label key={o.id} className="layer-option">
                <input type="checkbox" checked={o.state} onChange={e => o.setter(e.target.checked)} />
                <img src={`https://img.icons8.com/fluency/48/${o.icon}.png`} width="18" height="18" alt={o.label} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
      </div>

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
        <PopularLocationsAQI show={showCities} refreshKey={refreshKey} />
        <TemperatureLayer show={tempLayer} refreshKey={refreshKey} />

        {/* Auto-fly to user location whenever coordinates change */}
        <FlyToOnMount lat={lat} lon={lon} />

        {/* Controls */}
        <RecenterControl lat={lat} lon={lon} onOffCenter={() => setOffCenter(true)} onBackCenter={() => setOffCenter(false)} />
        <RefreshControl onRefresh={() => setRefreshKey(k => k + 1)} />
        <ZoomControls />
        <ClickMapEvent setPopupData={setPopupData} />
        <LegendCollapseHandler legendOpen={legendOpen} setLegendOpen={setLegendOpen} />

        {/* Dynamic click popup */}
        {popupData && (
          <Popup position={[popupData.lat, popupData.lng]} onClose={() => setPopupData(null)} className="dark-popup">
            {popupData.loading ? (
              <div style={{ color: '#fff', padding: '8px', minWidth: '120px', textAlign: 'center' }}>Fetching AQI...</div>
            ) : popupData.error ? (
              <div style={{ color: '#ff4444', padding: '8px' }}>Failed to load data</div>
            ) : (
              <div className="aqi-popup-inner" style={{ padding: '4px' }}>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Air Quality</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: getAqiColor(popupData.aqi) }}>
                  {popupData.aqi}
                </div>
                <div style={{ fontSize: '13px', color: '#e8e8e8', marginBottom: '8px' }}>
                  {getAqiLabel(popupData.aqi)}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>
                  PM2.5: <span style={{ color: '#fff', fontWeight: 'bold' }}>{popupData.pm25} µg/m³</span>
                </div>
              </div>
            )}
          </Popup>
        )}

        {/* Location marker */}
        <Marker position={[lat, lon]} icon={pulseIcon}>
          <Popup className="dark-popup">
            <div className="aqi-popup-inner" style={{ padding: '4px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{city}</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{aqi}</div>
              <div style={{ fontSize: '13px', color: '#e8e8e8', marginBottom: '8px' }}>{aqiData?.status}</div>
              {aqiData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>PM2.5: <span style={{ color: '#fff' }}>{aqiData.pm2_5}</span></div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>PM10: <span style={{ color: '#fff' }}>{aqiData.pm10}</span></div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* ── Windy-Style Bottom Info Bar ── */}
      <div className="windy-bottom-bar">
        <div className="w-bar-left">
          {tempLayer ? 'Temperature' : 'AirVintage Map'}
        </div>
        <div className="w-bar-center">
          <span style={{ fontSize: '11px', marginRight: '8px' }}>Good</span>
          <div className="w-bar-gradient"></div>
          <span style={{ fontSize: '11px', marginLeft: '8px' }}>Hazardous</span>
        </div>
        <div className="w-bar-right">
          Data: <a href="https://open-meteo.com" target="_blank" rel="noreferrer" style={{ color: '#00d4ff', textDecoration: 'none', marginLeft: '4px' }}>Open-Meteo</a>
        </div>
      </div>

    </div>
  );
}

export default AQIMap;



