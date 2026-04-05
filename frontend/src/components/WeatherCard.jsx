import React from "react";



function getVisibilityDesc(v) {
    if (v === undefined || v === null) return "No data";
    if (v >= 40) return "Excellent visibility";
    if (v >= 20) return "Good — clear view";
    if (v >= 10) return "Moderate — some haze";
    return "Poor — fog or rain";
}

function getHumidityDesc(h) {
    if (h === undefined || h === null) return "No data";
    if (h < 30) return "Low — air feels dry";
    if (h < 60) return "Comfortable — ideal";
    if (h < 80) return "High — feels humid";
    return "Very High — sticky";
}

function getWindDesc(w) {
    if (w === undefined || w === null) return "No data";
    if (w < 5) return "Calm breeze";
    if (w < 12) return "Light wind";
    if (w < 25) return "Moderate wind";
    if (w < 40) return "Strong wind";
    return "Storm-force winds";
}

function getWindDirDeg(dir) {
    const map = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
    return map[dir] ?? 0;
}

function WeatherCard({ weatherData }) {
    if (!weatherData) return null;
    const windDeg = getWindDirDeg(weatherData.wind_direction);

    return (
        <div className="panel animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="panel-header">
                <span className="panel-title">Weather Details</span>
                <div className="panel-condition-badge">
                    {weatherData.condition}
                </div>
            </div>
            <div className="details-grid">

                {/* Humidity */}
                <div className="detail-card">
                    <div className="detail-card-label">Humidity</div>
                    <div className="detail-card-value">
                        {weatherData.humidity}<span className="detail-card-unit">%</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar humidity-bar" style={{ width: `${weatherData.humidity}%` }} />
                    </div>
                    <div className="detail-card-desc">{getHumidityDesc(weatherData.humidity)}</div>
                </div>

                {/* Wind Speed */}
                <div className="detail-card">
                    <div className="detail-card-label">Wind Speed</div>
                    <div className="detail-card-value">
                        {weatherData.wind_speed}<span className="detail-card-unit"> km/h</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar wind-bar" style={{ width: `${Math.min((weatherData.wind_speed / 50) * 100, 100)}%` }} />
                    </div>
                    <div className="detail-card-desc">{getWindDesc(weatherData.wind_speed)}</div>
                </div>

                {/* Visibility */}
                <div className="detail-card">
                    <div className="detail-card-label">Visibility</div>
                    <div className="detail-card-value">
                        {weatherData.visibility}<span className="detail-card-unit"> km</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar visibility-bar" style={{ width: `${Math.min((weatherData.visibility / 60) * 100, 100)}%` }} />
                    </div>
                    <div className="detail-card-desc">{getVisibilityDesc(weatherData.visibility)}</div>
                </div>

                {/* Temperature */}
                <div className="detail-card">
                    <div className="detail-card-label">Temperature</div>
                    <div className="detail-card-value">
                        {weatherData.temperature}<span className="detail-card-unit">°C</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar temp-bar" style={{ width: `${Math.min(((weatherData.temperature + 10) / 55) * 100, 100)}%` }} />
                    </div>
                    <div className="detail-card-desc">
                        {weatherData.min_temp != null ? `${weatherData.min_temp}° – ${weatherData.max_temp}° today` : "Current temperature"}
                    </div>
                </div>

                {/* Wind Direction */}
                <div className="detail-card">
                    <div className="detail-card-label">Wind Direction</div>
                    <div className="detail-card-value">{weatherData.wind_direction}</div>
                    <div className="wind-compass">
                        <div className="compass-dial">
                            <div className="compass-needle" style={{ transform: `rotate(${windDeg}deg)` }} />
                            <span className="compass-n">N</span>
                            <span className="compass-s">S</span>
                            <span className="compass-e">E</span>
                            <span className="compass-w">W</span>
                        </div>
                    </div>
                </div>

                {/* Condition card */}
                <div className="detail-card">
                    <div className="detail-card-label">Condition</div>
                    <div className="detail-card-value" style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>
                        {weatherData.condition}
                    </div>
                    <div className="detail-card-desc">
                        {weatherData.is_day === 1 ? "Daytime" : "Nighttime"}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default WeatherCard;