import React from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function makePulseIcon(color) {
  return L.divIcon({
    className: "",
    iconSize:   [20, 20],
    iconAnchor: [10, 10],
    html: `
      <div class="gm-dot-wrapper" style="transform: scale(0.8)">
        <div class="gm-dot-pulse" style="background:${color}22;border-color:${color}44"></div>
        <div class="gm-dot-pulse gm-dot-pulse-2" style="background:${color}11;border-color:${color}33"></div>
        <div class="gm-dot-core" style="background:${color};box-shadow:0 0 0 3px ${color}55,0 2px 8px ${color}88"></div>
        <div class="gm-dot-inner"></div>
      </div>`,
  });
}

function getAqiColor(aqi) {
  if (!aqi) return "#60a5fa";
  if (aqi <= 50)  return "#22c55e";
  if (aqi <= 100) return "#eab308";
  if (aqi <= 150) return "#f97316";
  if (aqi <= 200) return "#ef4444";
  if (aqi <= 300) return "#a855f7";
  return "#dc2626";
}

function DashboardMapCard({ coordinates, aqiData, setCurrentPage }) {
    if (!coordinates) return null;

    const lat = parseFloat(coordinates.lat);
    const lon = parseFloat(coordinates.lon);
    const aqi = aqiData?.aqi || 0;
    const color = getAqiColor(aqi);
    const pulseIcon = makePulseIcon(color);

    return (
        <div className="panel animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}>
                <span className="panel-title">Local Map View</span>
                <button 
                  className="read-article-link" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setCurrentPage('map')}
                >
                  <span className="link-text">Full Map</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
            </div>
            
            <div style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div 
                   style={{ position: 'absolute', inset: 0, zIndex: 500, cursor: 'pointer' }}
                   onClick={() => setCurrentPage('map')}
                   title="Click to open Interactive Map"
                />
                <MapContainer
                    center={[lat, lon]}
                    zoom={12}
                    zoomControl={false}
                    scrollWheelZoom={false}
                    dragging={false}
                    doubleClickZoom={false}
                    attributionControl={false}
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" />
                    {aqiLayerEnabled && <TileLayer url="https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=YOUR_WAQI_TOKEN_HERE" opacity={0.6} zIndex={10} />}
                    <Marker position={[lat, lon]} icon={pulseIcon} />
                </MapContainer>
            </div>
        </div>
    );
}

const aqiLayerEnabled = false; // Add your WAQI token above if you want mini-map AQI overlay

export default DashboardMapCard;