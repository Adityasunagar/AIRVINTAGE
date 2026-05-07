import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import LocationDetector from "./components/LocationDetector";
import WeatherCard from "./components/WeatherCard";
import AQICard from "./components/AQICard";
import Navbar from "./components/Navbar";
import AQIMap from "./components/AQIMap";
import DashboardMapCard from "./components/DashboardMapCard";
import AboutPage from "./components/AboutPage";
import NewsList from "./components/NewsList";
import NewsDetail from "./components/NewsDetail";
import SkeletonScreen from "./components/SkeletonScreen";
import ForecastSection from "./components/forecast/ForecastSection";
import ForecastCard from "./components/forecast/ForecastCard";
import SmartRecommendationsCard from "./components/SmartRecommendationsCard";
import AQITrendChart from "./components/AQITrendChart";

function getAqiColorClass(aqi) {
  if (!aqi) return "";
  if (aqi <= 50) return "aqi-good";
  if (aqi <= 100) return "aqi-moderate";
  if (aqi <= 150) return "aqi-sensitive";
  if (aqi <= 200) return "aqi-unhealthy";
  if (aqi <= 300) return "aqi-very-unhealthy";
  return "aqi-hazardous";
}

function HeroBackground({ aqiColor }) {
  const color = aqiColor || "rgba(56,189,248,0.5)";
  const dots = [
    [8,12],[18,7],[32,18],[45,9],[60,22],[74,8],[88,15],[95,28],
    [5,38],[15,52],[28,44],[42,58],[55,35],[68,48],[80,62],[92,42],
    [10,68],[22,78],[38,65],[50,72],[63,80],[77,70],[90,85],[97,60],
  ];
  return (
    <div className="hero-bg-layer" aria-hidden="true">
      <svg className="hero-dot-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r="1.5" fill={color} opacity="0.25" />
        ))}
      </svg>
      <div className="hero-sonar">
        <div className="sonar-ring sonar-r1" style={{ borderColor: color }} />
        <div className="sonar-ring sonar-r2" style={{ borderColor: color }} />
        <div className="sonar-ring sonar-r3" style={{ borderColor: color }} />
        <div className="sonar-core" style={{ background: color }} />
      </div>
    </div>
  );
}

// ── Inner app that can access Router hooks ──
function AppInner() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [coordinates, setCoordinates]   = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [weatherData, setWeatherData]   = useState(null);
  const [aqiData, setAqiData]           = useState(null);
  const [loading, setLoading]           = useState(false);
  const [theme, setTheme]               = useState("dark");
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [showDetector, setShowDetector] = useState(false);

  // Derive "current page" from the URL path for the Navbar active state
  const currentPage = location.pathname.split("/")[1] || "dashboard";

  const fetchData = useCallback(async (coords) => {
    if (!coords) return;
    setLoading(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
      const resp = await fetch(`${apiUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lon: coords.lon }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setWeatherData(data.weather_data);
        setAqiData(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (coordinates) fetchData(coordinates);
  }, [coordinates, fetchData]);

  // Auto-refresh every 5 minutes to give a real-time feel
  useEffect(() => {
    if (!coordinates) return;
    const intervalId = setInterval(() => fetchData(coordinates), 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [coordinates, fetchData]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const aqiClass = getAqiColorClass(aqiData?.aqi);

  return (
    <div className={`App ${theme}`}>
      {/* ── Animated Background ── */}
      <div className="sky-background" data-theme={theme}>
        <div className="stars" />
        <div className="clouds" />
        {theme === "light" && <div className="day-atmosphere" />}
      </div>

      {/* ── Persistent Navbar ── */}
      <Navbar
        currentPage={currentPage}
        setCurrentPage={(page) => navigate(page === "dashboard" ? "/" : `/${page}`)}
        locationName={locationName}
        theme={theme}
        setTheme={setTheme}
        onRefresh={() => fetchData(coordinates)}
        loading={loading}
        lastUpdated={lastUpdated}
        onDetectLocation={() => setShowDetector(true)}
      />

      {/* ── Location Detector overlay — global so it works from any page ── */}
      {(!coordinates || showDetector) && (
        <LocationDetector
          setCoordinates={(c) => { setCoordinates(c); setShowDetector(false); }}
          setLocationName={setLocationName}
          onClose={coordinates ? () => setShowDetector(false) : undefined}
        />
      )}

      {/* ── Routes ── */}
      <Routes>
        {/* Dashboard */}
        <Route
          path="/"
          element={
            loading ? (
              <SkeletonScreen />
            ) : (
              <div className="app-content-wrapper">
                <div className={`premium-hero ${aqiClass}`}>
                  <HeroBackground aqiColor={
                    aqiData
                      ? aqiData.aqi <= 50  ? "rgba(34,197,94,0.6)"
                      : aqiData.aqi <= 100 ? "rgba(234,179,8,0.6)"
                      : aqiData.aqi <= 150 ? "rgba(249,115,22,0.6)"
                      : aqiData.aqi <= 200 ? "rgba(239,68,68,0.6)"
                      : "rgba(168,85,247,0.6)"
                      : "rgba(56,189,248,0.4)"
                  } />
                  {aqiData ? (
                    <>
                      <div className="hero-aqi-label">Air Quality Index</div>
                      <div className="hero-aqi-value">{aqiData.aqi || "--"}</div>
                      <div className={`hero-aqi-status-badge ${aqiClass}`}>{aqiData.status || "Unknown"}</div>
                      {weatherData && (
                        <div className="hero-weather-summary">
                          {weatherData.condition} · {weatherData.temperature}°C
                          {weatherData.min_temp != null
                            ? ` · ${weatherData.min_temp}° / ${weatherData.max_temp}°`
                            : ""}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="hero-loading">Loading Air Quality Data...</div>
                  )}
                </div>

                {/* Location Detector overlay moved to App top-level */}

                <main className="main-content premium-main">
                  {coordinates && (
                    <ForecastCard
                      lat={coordinates.lat}
                      lon={coordinates.lon}
                      onClick={() => navigate("/forecast")}
                    />
                  )}

                  {/* AI Recommendations + AQI Trend side by side */}
                  <div className="dashboard-insights-row">
                    {(aqiData || weatherData) && (
                      <SmartRecommendationsCard aqiData={aqiData} weatherData={weatherData} />
                    )}
                    {coordinates && (
                      <AQITrendChart 
                        lat={coordinates.lat} 
                        lon={coordinates.lon} 
                        currentAqi={aqiData ? aqiData.aqi : null}
                        currentStatus={aqiData ? aqiData.status : null}
                      />
                    )}
                  </div>

                  <div className="dashboard-insights-row">
                    {aqiData && <AQICard aqiData={aqiData} />}
                    {weatherData && <WeatherCard weatherData={weatherData} />}
                  </div>
                  {coordinates && aqiData && (
                    <DashboardMapCard
                      coordinates={coordinates}
                      aqiData={aqiData}
                      setCurrentPage={(page) => navigate(`/${page}`)}
                    />
                  )}
                </main>
              </div>
            )
          }
        />

        {/* Map */}
        <Route
          path="/map"
          element={
            <div className="map-fullscreen-wrapper">
              <AQIMap
                coordinates={coordinates}
                aqiData={aqiData}
                locationName={locationName}
                theme={theme}
              />
            </div>
          }
        />

        {/* Forecast */}
        <Route
          path="/forecast"
          element={
            <div className="page-wrapper main-content">
              <h2 className="section-title" style={{ margin: "20px 0", color: "var(--text-1)" }}>
                Detailed Forecast
              </h2>
              {coordinates ? (
                <ForecastSection lat={coordinates.lat} lon={coordinates.lon} />
              ) : (
                <div style={{ padding: "100px 20px", textAlign: "center", color: "var(--text-2)" }}>
                  Please detect your location first.
                </div>
              )}
            </div>
          }
        />

        {/* News List */}
        <Route
          path="/news"
          element={
            <div className="page-wrapper main-content">
              <NewsList locationName={locationName} />
            </div>
          }
        />

        {/* News Detail — full in-app article view */}
        <Route
          path="/news/:id"
          element={
            <div className="page-wrapper main-content">
              <NewsDetail />
            </div>
          }
        />

        {/* About */}
        <Route
          path="/about"
          element={
            <div className="page-wrapper">
              <AboutPage />
            </div>
          }
        />

        {/* Fallback — redirect unknown paths to dashboard */}
        <Route path="*" element={<></>} />
      </Routes>
    </div>
  );
}

export default function App() {
  return <AppInner />;
}
