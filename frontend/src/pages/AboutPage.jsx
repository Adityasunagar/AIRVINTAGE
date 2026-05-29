import React from "react";
import { 
  Globe, Wind, BarChart3, Microscope, Database, CloudSun, MapPin, Map, 
  CloudFog, Car, Factory, ShieldAlert, Flame, Hexagon
} from "lucide-react";

const AQI_LEVELS = [
  { range: "0 – 50",   label: "Good",               color: "#22c55e", bg: "rgba(34,197,94,0.1)",   desc: "Air quality is satisfactory and poses little or no risk to health." },
  { range: "51 – 100", label: "Moderate",            color: "#eab308", bg: "rgba(234,179,8,0.1)",   desc: "Acceptable air quality, but some pollutants may be a concern for sensitive people." },
  { range: "101 – 150",label: "Unhealthy (Sensitive)",color: "#f97316", bg: "rgba(249,115,22,0.1)", desc: "Members of sensitive groups may experience health effects." },
  { range: "151 – 200",label: "Unhealthy",           color: "#ef4444", bg: "rgba(239,68,68,0.1)",   desc: "Everyone may begin to experience health effects." },
  { range: "201 – 300",label: "Very Unhealthy",      color: "#a855f7", bg: "rgba(168,85,247,0.1)",  desc: "Health alert: The entire population is more likely to be affected." },
  { range: "301+",     label: "Hazardous",           color: "#dc2626", bg: "rgba(220,38,38,0.1)",   desc: "Emergency conditions. The entire population is almost certainly affected." },
];

function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-icon"><Globe size={48} color="var(--accent)" strokeWidth={1.5} /></div>
        <h1 className="about-title">About <span>AirVintage</span></h1>
        <p className="about-subtitle">
          AirVintage is a real-time environmental health monitoring platform that surfaces your hyper-local
          Air Quality Index (AQI) alongside live weather data — so you know exactly what you're breathing.
        </p>
      </div>

      <div className="about-section">
        <h2 className="about-section-title">
          <Wind className="section-title-icon" size={24} color="var(--accent)" /> What is AQI?
        </h2>
        <p className="about-section-text">
          The Air Quality Index (AQI) is a standardized indicator developed by the United States Environmental 
          Protection Agency (US EPA) to communicate how polluted the air currently is. It factors in six major 
          pollutants — PM2.5, PM10, CO, NO₂, O₃, and SO₂ — into a single number ranging from 0 to 500.
          Higher values indicate greater levels of air pollution and a greater health concern.
        </p>
      </div>

      <div className="about-section">
        <h2 className="about-section-title">
          <BarChart3 className="section-title-icon" size={24} color="var(--accent)" /> AQI Scale
        </h2>
        <div className="aqi-scale-grid">
          {AQI_LEVELS.map((level) => (
            <div key={level.label} className="aqi-scale-card" style={{ background: level.bg }}>
              <div className="scale-card-header">
                <span className="scale-range" style={{ color: level.color }}>{level.range}</span>
                <span className="scale-label" style={{ color: level.color }}>{level.label}</span>
              </div>
              <p className="scale-desc">{level.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="about-section">
        <h2 className="about-section-title">
          <Microscope className="section-title-icon" size={24} color="var(--accent)" /> Pollutants Monitored
        </h2>
        <div className="pollutant-grid">
          {[
            { icon: <Hexagon size={28} color="#f87171" strokeWidth={1.5}/>, name: "PM2.5", desc: "Fine particles ≤2.5μm. Penetrate deep into lungs and bloodstream." },
            { icon: <CloudFog size={28} color="#fb923c" strokeWidth={1.5}/>, name: "PM10", desc: "Coarse particles ≤10μm. Cause respiratory and eye irritation." },
            { icon: <Car size={28} color="#a855f7" strokeWidth={1.5}/>, name: "CO", desc: "Carbon Monoxide from vehicle exhaust. Reduces oxygen in blood." },
            { icon: <Factory size={28} color="#ef4444" strokeWidth={1.5}/>, name: "NO₂", desc: "Nitrogen Dioxide from industry. Inflames airway lining." },
            { icon: <ShieldAlert size={28} color="#3b82f6" strokeWidth={1.5}/>, name: "O₃", desc: "Ground-level Ozone. Triggers asthma and lung inflammation." },
            { icon: <Flame size={28} color="#facc15" strokeWidth={1.5}/>, name: "SO₂", desc: "Sulphur Dioxide from fossil fuels. Causes acid rain." },
          ].map((p) => (
            <div key={p.name} className="pollutant-card">
              <div className="pollutant-icon">{p.icon}</div>
              <div className="pollutant-name">{p.name}</div>
              <div className="pollutant-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-section">
        <h2 className="about-section-title">
          <Database className="section-title-icon" size={24} color="var(--accent)" /> Data Sources
        </h2>
        <div className="sources-grid">
          <div className="source-card">
            <div className="source-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CloudSun size={20} color="#3b82f6"/> Open-Meteo
            </div>
            <div className="source-desc">Free, open-source weather and air quality API. No API key required.</div>
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="source-link">Visit →</a>
          </div>
          <div className="source-card">
            <div className="source-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={20} color="#f87171"/> BigDataCloud
            </div>
            <div className="source-desc">Reverse geocoding API to convert GPS coordinates to human-readable city names.</div>
            <a href="https://bigdatacloud.com" target="_blank" rel="noreferrer" className="source-link">Visit →</a>
          </div>
          <div className="source-card">
            <div className="source-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Map size={20} color="#10b981"/> CartoDB / Leaflet
            </div>
            <div className="source-desc">Free, open-source interactive mapping library with dark mode tile layers.</div>
            <a href="https://carto.com" target="_blank" rel="noreferrer" className="source-link">Visit →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
