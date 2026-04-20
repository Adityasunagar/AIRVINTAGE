import React, { useCallback, useEffect, useState } from "react";
import "../App.css";
import LocationDetector from "../components/LocationDetector";
import WeatherCard from "../components/WeatherCard";
import AQICard from "../components/AQICard";
import Navbar from "../components/Navbar";
import AQIMap from "../components/AQIMap";
import DashboardMapCard from "../components/DashboardMapCard";
import AboutPage from "../components/AboutPage";
import SkeletonScreen from "../components/SkeletonScreen";
import { useWeatherBackground } from "../hooks/useWeatherBackground";
import ForecastSection from "../components/forecast/ForecastSection";

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
		[8, 12], [18, 7], [32, 18], [45, 9], [60, 22], [74, 8], [88, 15], [95, 28],
		[5, 38], [15, 52], [28, 44], [42, 58], [55, 35], [68, 48], [80, 62], [92, 42],
		[10, 68], [22, 78], [38, 65], [50, 72], [63, 80], [77, 70], [90, 85], [97, 60],
	];

	return (
		<div className="hero-bg-layer" aria-hidden="true">
			<svg className="hero-dot-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				{dots.map(([cx, cy], i) => (
					<circle
						key={i}
						cx={`${cx}%`}
						cy={`${cy}%`}
						r="1.5"
						fill={color}
						opacity="0.25"
					/>
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

function Dashboard() {
	const [coordinates, setCoordinates] = useState({ lat: 19.0760, lon: 72.8777 });
	const [locationName, setLocationName] = useState({ city: "Mumbai" });
	const [weatherData, setWeatherData] = useState(null);
	const [aqiData, setAqiData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [currentPage, setCurrentPage] = useState("dashboard");
	const [theme, setTheme] = useState("dark");

	const fetchData = useCallback(async (coords) => {
		if (!coords) return;
		setLoading(true);

		try {
			const response = await fetch(`http://127.0.0.1:8000/predict`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat: coords.lat, lon: coords.lon })
			});

			if (response.ok) {
				const data = await response.json();
				setWeatherData(data.weather_data);
				setAqiData(data);
			}
		} catch (error) {
			console.error("Fetch error:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (coordinates) {
			fetchData(coordinates);
		}
	}, [coordinates, fetchData]);

	useEffect(() => {
		document.body.className = theme;
	}, [theme]);

	// Use production-grade weather background hook
	useWeatherBackground(weatherData);

	const aqiClass = getAqiColorClass(aqiData?.aqi);

	return (
		<div className={`App ${theme}`}>
			<div className="sky-background" data-theme={theme}>
				{/* Animated Ambient Background Glows */}
				<div className="ambient-orb orb-1"></div>
				<div className="ambient-orb orb-2"></div>
				<div className="ambient-orb orb-3"></div>
				
				<div className="stars" />
				<div className="clouds" />
				{theme === "light" && <div className="day-atmosphere" />}
			</div>

			<Navbar
				currentPage={currentPage}
				setCurrentPage={setCurrentPage}
				locationName={locationName}
				theme={theme}
				setTheme={setTheme}
				onRefresh={() => fetchData(coordinates)}
				loading={loading || !coordinates}
			/>

			{!coordinates ? (
				<>
					<SkeletonScreen />
					<LocationDetector setCoordinates={setCoordinates} setLocationName={setLocationName} />
				</>
			) : loading ? (
				<SkeletonScreen />
			) : (
				<>
					{currentPage === "dashboard" && (
						<div className="app-content-wrapper">
							<div className={`premium-hero ${aqiClass}`}>
								<HeroBackground
									aqiColor={
										aqiData
											? aqiData.aqi <= 50
												? "rgba(34,197,94,0.6)"
												: aqiData.aqi <= 100
													? "rgba(234,179,8,0.6)"
													: aqiData.aqi <= 150
														? "rgba(249,115,22,0.6)"
														: aqiData.aqi <= 200
															? "rgba(239,68,68,0.6)"
															: "rgba(168,85,247,0.6)"
											: "rgba(56,189,248,0.4)"
									}
								/>

								{aqiData && weatherData ? (
									<>
										<div className="hero-aqi-label">Air Quality Index</div>
										<div className="hero-aqi-value">{aqiData.aqi}</div>
										<div className={`hero-aqi-status-badge ${aqiClass}`}>{aqiData.status}</div>
										<div className="hero-weather-summary">
											{weatherData.condition} - {weatherData.temperature}C
											{weatherData.min_temp != null
												? ` - ${weatherData.min_temp}° / ${weatherData.max_temp}°`
												: ""}
										</div>
									</>
								) : null}
							</div>

							<div style={{ color: 'red', fontWeight: 'bold', textAlign: 'center', padding: '10px', background: 'yellow', zIndex: 9999 }}>
								--- DEBUG: FORECAST COMPONENT MOUNT POINT ---
							</div>
							<div className="forecast-outer-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
								<ForecastSection lat={coordinates.lat} lon={coordinates.lon} />
							</div>

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

export default Dashboard;
