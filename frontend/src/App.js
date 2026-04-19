import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import LocationDetector from "./components/LocationDetector";
import WeatherCard from "./components/WeatherCard";
import AQICard from "./components/AQICard";
import Navbar from "./components/Navbar";
import AQIMap from "./components/AQIMap";
import DashboardMapCard from "./components/DashboardMapCard";
import AboutPage from "./components/AboutPage";
import NewsPage from "./components/NewsPage";
import SkeletonScreen from "./components/SkeletonScreen";


function getAqiColorClass(aqi) {
  if (!aqi) return "";
  if (aqi <= 50) return "aqi-good";
  if (aqi <= 100) return "aqi-moderate";
  if (aqi <= 150) return "aqi-sensitive";
  if (aqi <= 200) return "aqi-unhealthy";
  if (aqi <= 300) return "aqi-very-unhealthy";
  return "aqi-hazardous";
}

// ── Professional Hero Background: sonar pulse rings + particle grid ──
function HeroBackground({ aqiColor }) {
  const color = aqiColor || "rgba(56,189,248,0.5)";
  // pre-generate fixed dot positions so they don't re-randomise on render
  const dots = [
    [8,12],[18,7],[32,18],[45,9],[60,22],[74,8],[88,15],[95,28],
    [5,38],[15,52],[28,44],[42,58],[55,35],[68,48],[80,62],[92,42],
    [10,68],[22,78],[38,65],[50,72],[63,80],[77,70],[90,85],[97,60],
  ];
  return (
    <div className="hero-bg-layer" aria-hidden="true">
      {/* Dot particle grid */}
      <svg className="hero-dot-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {dots.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={`${cx}%`} cy={`${cy}%`}
            r="1.5"
            fill={color}
            opacity="0.25"
          />
        ))}
      </svg>
      {/* Sonar pulse rings — centred on hero */}
      <div className="hero-sonar">
        <div className="sonar-ring sonar-r1" style={{ borderColor: color }} />
        <div className="sonar-ring sonar-r2" style={{ borderColor: color }} />
        <div className="sonar-ring sonar-r3" style={{ borderColor: color }} />
        <div className="sonar-core" style={{ background: color }} />
      </div>
    </div>
  );
}


function App() {
  const [coordinates, setCoordinates] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, _setCurrentPage] = useState(() => {
    // Get the initial page from the path (e.g. /news -> 'news')
    const path = window.location.pathname.replace("/", "");
    return ["dashboard", "map", "news", "about"].includes(path) ? path : "dashboard";
  });

  // Handle browser back/forward buttons seamlessly
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.replace("/", "");
      _setCurrentPage(["dashboard", "map", "news", "about"].includes(path) ? path : "dashboard");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setCurrentPage = (page) => {
    _setCurrentPage(page);
    // Add to history stack without reloading the page
    window.history.pushState({}, "", `/${page === "dashboard" ? "" : page}`);
  };

  const [theme, setTheme] = useState("dark");

  const fetchData = useCallback(async (coords) => {
    if (!coords) return;
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/weather?lat=${coords.lat}&lon=${coords.lon}`),
        fetch(`http://127.0.0.1:8000/aqi?lat=${coords.lat}&lon=${coords.lon}`)
      ]);
      if (wRes.ok && aRes.ok) {
        const [wData, aData] = await Promise.all([wRes.json(), aRes.json()]);
        setWeatherData(wData);
        setAqiData(aData);
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

  // Apply theme to body
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const aqiClass = getAqiColorClass(aqiData?.aqi);

  return (
    <div className={`App ${theme}`}>
      {/* ── Animated Background ── */}
      <div className="sky-background" data-theme={theme}>
        <div className="stars"></div>
        <div className="clouds"></div>
        {theme === "light" && <div className="day-atmosphere"></div>}
      </div>

      {!coordinates ? (
        <LocationDetector setCoordinates={setCoordinates} setLocationName={setLocationName} />
      ) : (
        <>
          {/* ── Persistent Navbar ── */}
          <Navbar
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            locationName={locationName}
            theme={theme}
            setTheme={setTheme}
            onRefresh={() => fetchData(coordinates)}
            loading={loading}
          />

          {/* ── Page Routing ── */}
          {currentPage === "dashboard" && (
            loading ? (
              <SkeletonScreen />
            ) : (
            <div className="app-content-wrapper">
              {/* ── AQI Hero ── */}
              <div className={`premium-hero ${aqiClass}`}>
                {/* Professional sonar background */}
                <HeroBackground aqiColor={
                  aqiData ? (
                    aqiData.aqi <= 50  ? "rgba(34,197,94,0.6)"  :
                    aqiData.aqi <= 100 ? "rgba(234,179,8,0.6)"  :
                    aqiData.aqi <= 150 ? "rgba(249,115,22,0.6)" :
                    aqiData.aqi <= 200 ? "rgba(239,68,68,0.6)"  :
                                         "rgba(168,85,247,0.6)"
                  ) : "rgba(56,189,248,0.4)"
                } />

                {aqiData && weatherData ? (
                  <>
                    <div className="hero-aqi-label">Air Quality Index</div>
                    <div className="hero-aqi-value">{aqiData.aqi}</div>
                    <div className={`hero-aqi-status-badge ${aqiClass}`}>{aqiData.status}</div>
                    <div className="hero-weather-summary">
                      {weatherData.condition} · {weatherData.temperature}°C
                      {weatherData.min_temp != null ? ` · ${weatherData.min_temp}° / ${weatherData.max_temp}°` : ""}
                    </div>
                  </>
                ) : null}
              </div>

              {/* ── Dashboard Panels ── */}
              <main className="main-content premium-main">
                {aqiData && <AQICard aqiData={aqiData} />}
                {weatherData && <WeatherCard weatherData={weatherData} />}
                {coordinates && aqiData && (
                  <DashboardMapCard
                    coordinates={coordinates}
                    aqiData={aqiData}
                    setCurrentPage={setCurrentPage}
                  />
                )}
              </main>
            </div>
            )
          )}

          {currentPage === "map" && (
            <div className="map-fullscreen-wrapper">
              <AQIMap
                coordinates={coordinates}
                aqiData={aqiData}
                locationName={locationName}
                theme={theme}
              />
            </div>
          )}

          {currentPage === "news" && (
            <div className="page-wrapper main-content">
              <NewsPage theme={theme} />
            </div>
          )}

          {currentPage === "about" && (
            <div className="page-wrapper">
              <AboutPage />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
