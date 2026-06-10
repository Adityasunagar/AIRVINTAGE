import React, { useState, useEffect } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker,
  Popup, Circle, useMap, useMapEvents
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
function getAqiTextColor(aqi, isLight) {
  if (isLight) {
    if (!aqi) return "#0284c7";
    if (aqi <= 50)  return "#16a34a";
    if (aqi <= 100) return "#ca8a04";
    if (aqi <= 150) return "#d97706";
    if (aqi <= 200) return "#dc2626";
    if (aqi <= 300) return "#7c3aed";
    return "#9f1239";
  } else {
    return getAqiColor(aqi);
  }
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
function RecenterControl({ lat, lon, onOffCenter, onBackCenter, flyHomeRef }) {
  const map = useMap();

  useMapEvents({
    moveend() {
      const c = map.getCenter();
      const lngDiff = ((c.lng - lon + 180) % 360 + 360) % 360 - 180;
      const dist = Math.hypot(c.lat - lat, lngDiff);
      dist > 0.15 ? onOffCenter() : onBackCenter();
    },
  });

  // Keep the ref always pointing at the latest flyHome so the button
  // outside MapContainer never calls a stale closure.
  React.useEffect(() => {
    flyHomeRef.current = () => {
      const wraps = Math.round((map.getCenter().lng - lon) / 360);
      map.flyTo([lat, lon + wraps * 360], 14, { duration: 1.4, easeLinearity: 0.2 });
    };
  });

  return null;
}

/* ─────────────────────────────────────────────
   Map Click Handler for AQI Popup
   Routes through AirVintage /predict (ML model)
   so values match the dashboard — NOT raw Open-Meteo
───────────────────────────────────────────── */
function ClickMapEvent({ setPopupData }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      setPopupData({ lat, lng, loading: true });

      // Try AirVintage backend first (ML-corrected, same as dashboard)
      try {
        const apiUrl = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;
        const res = await fetch(`${apiUrl}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon: lng }),
        });
        if (!res.ok) throw new Error("Backend error");
        const data = await res.json();
        setPopupData({
          lat, lng, loading: false,
          aqi:    data.aqi,
          pm25:   data.pm2_5,
          status: data.status,
          source: "AirVintage ML",
        });
        return;
      } catch {
        // Fall back to Open-Meteo if backend unreachable
      }

      // Fallback: Open-Meteo raw sensor (labelled so user knows)
      try {
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&timezone=auto`
        );
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setPopupData({
          lat, lng, loading: false,
          aqi:    data.current.us_aqi,
          pm25:   data.current.pm2_5,
          source: "Open-Meteo (raw)",
        });
      } catch {
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
  // Attach L.DomEvent.disableClickPropagation so clicks on this
  // control never bubble through to Leaflet's map-click handler.
  const containerRef = React.useCallback((node) => {
    if (node) L.DomEvent.disableClickPropagation(node);
  }, []);

  return (
    <div className="gm-refresh-control" ref={containerRef}>
      <button
        className="gm-zoom-btn"
        onClick={(e) => {
          e.stopPropagation();
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

  // Attach L.DomEvent.disableClickPropagation so clicks on zoom
  // buttons never bubble through to Leaflet's map-click handler.
  const containerRef = React.useCallback((node) => {
    if (node) L.DomEvent.disableClickPropagation(node);
  }, []);

  return (
    <div className="gm-zoom-controls" ref={containerRef}>
      <button
        className="gm-zoom-btn"
        onClick={(e) => { e.stopPropagation(); map.zoomIn(); }}
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
        onClick={(e) => { e.stopPropagation(); map.zoomOut(); }}
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
function AQIMap({ coordinates, aqiData, locationName, theme = 'dark', setCoordinates, setLocationName }) {
  const [offCenter, setOffCenter] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [popupData, setPopupData] = useState(null);

  const [baseMap, setBaseMap] = useState('Dark');
  const [waqiLayer, setWaqiLayer] = useState(false);

  // Stable ref so RecenterControl's flyHome never goes stale
  const flyHomeRef = React.useRef(null);

  // Sync baseMap with global theme toggle when user clicks the nav sun/moon
  useEffect(() => {
    setBaseMap(theme === 'dark' ? 'Dark' : 'Map');
  }, [theme]);
  const [tempLayer, setTempLayer] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  const markerRef = React.useRef(null);
  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newLatLng = marker.getLatLng();
          if (setCoordinates) {
            setCoordinates({ lat: newLatLng.lat, lon: newLatLng.lng });
          }
          if (setLocationName) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLatLng.lat}&lon=${newLatLng.lng}&zoom=18&addressdetails=1`, {
              headers: {'Accept-Language': 'en'}
            })
              .then(res => res.json())
              .then(data => {
                const cityVal = data.name || data.address?.village || data.address?.town || data.address?.city || 'Selected Point';
                setLocationName({
                  city: cityVal,
                  state: data.address?.state || '',
                  country: data.address?.country || ''
                });
              })
              .catch(() => {
                setLocationName({ city: 'Selected Location', state: '', country: '' });
              });
          }
        }
      },
    }),
    [setCoordinates, setLocationName]
  );

  const handleRefreshLocation = React.useCallback(() => {
    // Force reload overlays
    setRefreshKey(k => k + 1);

    const fetchIPLocation = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("IP geolocation failed");
        const data = await res.json();
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        const cityVal = data.city || 'Local Region';
        const state = data.region || '';
        const country = data.country_name || '';
        if (setLocationName) setLocationName({ city: cityVal, state, country });
        if (setCoordinates) setCoordinates({ lat, lon, accuracy: null });
      } catch (err) {
        console.error("IP Geolocation failed in map refresh:", err);
      }
    };

    if (!navigator.geolocation) { fetchIPLocation(); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Use raw GPS — no city-center snapping so flyTo goes to actual location
        const lat = parseFloat(pos.coords.latitude.toFixed(7));
        const lon = parseFloat(pos.coords.longitude.toFixed(7));
        const accuracy = pos.coords.accuracy;

        let cityVal = '';
        let state = '';
        let country = '';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            cityVal = data.name || '';
            if (!cityVal && data.address) {
              const a = data.address;
              for (const k of ['city','town','village','municipality','suburb','hamlet','county','state']) {
                if (a[k]) { cityVal = a[k]; break; }
              }
            }
            state = data.address?.state || '';
            country = data.address?.country || '';
          }
        } catch (err) {
          console.error("Geocoding failed on map refresh:", err);
        }

        if (!cityVal) cityVal = 'My Location';
        if (setLocationName) setLocationName({ city: cityVal, state, country });
        if (setCoordinates) setCoordinates({ lat, lon, accuracy });
      },
      (err) => {
        console.warn("GPS failed on map refresh, falling back to IP:", err);
        fetchIPLocation();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setCoordinates, setLocationName]);

  if (!coordinates) return null;

  const lat      = parseFloat(coordinates.lat);
  const lon      = parseFloat(coordinates.lon);
  const accuracy = coordinates.accuracy || null;   // metres, from GPS
  const aqi    = aqiData?.aqi || 0;
  const color  = getAqiColor(aqi);
  const city   = locationName?.city || "Your Location";

  const pulseIcon = makePulseIcon(color);

  const isDark = theme === 'dark';
  const aqiTextColor = getAqiTextColor(aqi, !isDark);

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
            Air Quality Map — <span style={{ color: aqiTextColor }}>{city}</span>
          </span>
          {accuracy && (
            <span style={{
              fontSize: '10px',
              color: accuracy < 20 ? '#22c55e' : accuracy < 100 ? '#eab308' : '#f87171',
              background: accuracy < 20 ? 'rgba(34,197,94,0.1)' : accuracy < 100 ? 'rgba(234,179,8,0.1)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${accuracy < 20 ? 'rgba(34,197,94,0.3)' : accuracy < 100 ? 'rgba(234,179,8,0.3)' : 'rgba(248,113,113,0.3)'}`,
              borderRadius: '4px',
              padding: '1px 5px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}>
              ±{Math.round(accuracy)}m
            </span>
          )}
        </div>
        <div className="map-floating-aqi" style={{ color: aqiTextColor, borderLeft: `1px solid ${dividerColor}` }}>
          AQI {aqi} · <span style={{ color: mutedText, fontWeight: 500 }}>{getAqiLabel(aqi)}</span>
        </div>
      </div>

      {/* ── Collapsible Legend Pill (Left Panel) ── */}
      <div className={`map-legend-container ${legendOpen ? 'open' : ''}`}>
        {!legendOpen ? (
          <button
            className="map-legend-pill glassmorphism-dark"
            onClick={(e) => { e.stopPropagation(); setLegendOpen(true); }}
          >
            <span style={{ marginRight: '6px' }}>ℹ️</span> Legend
          </button>
        ) : (
          <div className="map-legend-card glassmorphism-dark">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', color: '#e8e8e8' }}>AQI LEGEND</span>
              <button onClick={(e) => { e.stopPropagation(); setLegendOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            
            <div className="legend-current" style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase' }}>Your AQI</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: aqiTextColor }}>{aqi} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>· {getAqiLabel(aqi)}</span></div>
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
        onClick={(e) => { e.stopPropagation(); setShowLayerMenu(!showLayerMenu); }}
        title="Maps & Overlays"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </button>

      {/* ── Layer Menu Card (Slide-In) ── */}
      <div className={`custom-layer-card glassmorphism-dark ${showLayerMenu ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: '10px' }}>
          <h4 className="layer-card-title" style={{ fontSize: '14px', margin: 0, fontWeight: 700, letterSpacing: '0.3px', color: '#e8e8e8' }}>Map Layers</h4>
          <button onClick={(e) => { e.stopPropagation(); setShowLayerMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Base Maps */}
            <div className="layer-section-title" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '4px' }}>Base Map</div>
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
            <div className="layer-section-title" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '4px' }}>Overlays</div>

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
        onClick={(e) => { e.stopPropagation(); flyHomeRef.current?.(); }}
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

      {/* RefreshControl lives OUTSIDE MapContainer so its clicks never
          reach Leaflet's map-click handler at all. CSS positions it
          absolutely within .map-page-full (position:relative). */}
      <RefreshControl onRefresh={handleRefreshLocation} />

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

        {waqiLayer && process.env.REACT_APP_WAQI_TOKEN && (
          <TileLayer
            url={`https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=${process.env.REACT_APP_WAQI_TOKEN}`}
            attribution="&copy; WAQI" opacity={0.7} zIndex={10}
          />
        )}

        <PopularLocationsAQI
          show={showCities} refreshKey={refreshKey}
          setCoordinates={setCoordinates} setLocationName={setLocationName}
        />
        <TemperatureLayer show={tempLayer} refreshKey={refreshKey} />
        <FlyToOnMount lat={lat} lon={lon} />

        {/* Controls that NEED useMap stay inside MapContainer */}
        <RecenterControl lat={lat} lon={lon} flyHomeRef={flyHomeRef} onOffCenter={() => setOffCenter(true)} onBackCenter={() => setOffCenter(false)} />
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Air Quality</div>
                  {popupData.source && (
                    <div style={{
                      fontSize: '9px', fontWeight: 600,
                      color: popupData.source === 'AirVintage ML' ? '#38bdf8' : '#94a3b8',
                      background: popupData.source === 'AirVintage ML' ? 'rgba(56,189,248,0.12)' : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${popupData.source === 'AirVintage ML' ? 'rgba(56,189,248,0.3)' : 'rgba(148,163,184,0.2)'}`,
                      borderRadius: '3px', padding: '1px 4px', letterSpacing: '0.03em',
                    }}>
                      {popupData.source}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: getAqiColor(popupData.aqi) }}>
                  {popupData.aqi}
                </div>
                <div style={{ fontSize: '13px', color: '#e8e8e8', marginBottom: '8px' }}>
                  {popupData.status || getAqiLabel(popupData.aqi)}

                </div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>
                  PM2.5: <span style={{ color: '#fff', fontWeight: 'bold' }}>{popupData.pm25} µg/m³</span>
                </div>
              </div>
            )}
          </Popup>
        )}

        {/* GPS Accuracy circle — like Google Maps' blue ring */}
        {accuracy && (
          <Circle
            center={[lat, lon]}
            radius={accuracy}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.06,
              weight: 1.5,
              opacity: 0.4,
              dashArray: '4 4',
            }}
          />
        )}

        {/* Location marker */}
        <Marker 
          position={[lat, lon]} 
          icon={pulseIcon}
          draggable={true}
          eventHandlers={eventHandlers}
          ref={markerRef}
        >
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



