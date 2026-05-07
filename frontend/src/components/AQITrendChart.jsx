import React, { useEffect, useState } from "react";

function aqiColor(aqi) {
  if (aqi <= 50) return "#4ade80";
  if (aqi <= 100) return "#facc15";
  if (aqi <= 150) return "#fb923c";
  if (aqi <= 200) return "#f87171";
  if (aqi <= 300) return "#c084fc";
  return "#7e2222";
}

function aqiLabel(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

const FORECAST_CACHE = {};

export default function AQITrendChart({ lat, lon, currentAqi, currentStatus }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHovered] = useState(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    setAnimated(false);

    const cacheKey = `${lat},${lon}`;
    if (FORECAST_CACHE[cacheKey]) {
      processForecastData(FORECAST_CACHE[cacheKey]);
      return;
    }

    const base = process.env.REACT_APP_API_URL || (window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "http://127.0.0.1:8000");

    fetch(`${base}/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          FORECAST_CACHE[cacheKey] = data;
          processForecastData(data);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    function processForecastData(data) {
      if (!data?.daily || !data?.hourly) {
        setLoading(false);
        return;
      }

      // Aggregate hourly AQI into daily averages
      const aggregated = data.daily.map((day) => {
        const dateStr = day.date.split("T")[0];
        const hourlyForDay = data.hourly.filter((h) => h.time.startsWith(dateStr));
        const aqiValues = hourlyForDay.map((h) => h.aqi).filter((v) => v != null && v > 0);
        const avgAqi = aqiValues.length
          ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
          : null;

        const d = new Date(day.date);
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        return { label, aqi: avgAqi, date: day.date };
      });

      const filtered = aggregated.filter((d) => d.aqi != null);

      // Override 'Today' (index 1) with ML currentAqi if provided
      if (currentAqi != null && filtered.length > 1) {
        filtered[1].aqi = currentAqi;
      }

      setDays(filtered);
      setLoading(false);
      setTimeout(() => setAnimated(true), 50);
    }
  }, [lat, lon, currentAqi]);

  if (loading) {
    return (
      <div className="panel aqi-trend-card">
        <div className="panel-header">
          <span className="panel-title">AQI Trend — 7 Days</span>
        </div>
        <div className="trend-skeleton">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="trend-skel-col">
              <div className="trend-skel-bar" style={{ height: `${30 + Math.random() * 40}%` }} />
              <div className="trend-skel-label" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (days.length < 2) return null;

  // SVG layout
  const W = 320, H = 110, PAD = 16;
  const aqiValues = days.map((d) => d.aqi);
  const minAqi = Math.min(...aqiValues) * 0.85;
  const maxAqi = Math.max(...aqiValues) * 1.1;

  const toX = (i) => PAD + (i / (days.length - 1)) * (W - PAD * 2);
  const toY = (v) => H - PAD - ((v - minAqi) / (maxAqi - minAqi)) * (H - PAD * 2.5);

  // Build polyline points
  const points = days.map((d, i) => `${toX(i)},${toY(d.aqi)}`).join(" ");

  // Build area fill path
  const firstX = toX(0), lastX = toX(days.length - 1);
  const areaPath = `M${firstX},${H - PAD} ` +
    days.map((d, i) => `L${toX(i)},${toY(d.aqi)}`).join(" ") +
    ` L${lastX},${H - PAD} Z`;

  // Today is index 1 (matching ForecastSection convention — idx 0 = yesterday)
  const todayIdx = 1;

  return (
    <div className="panel aqi-trend-card">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title">AQI Trend — 7 Days</span>
        {days[todayIdx] && (
          <span className="trend-today-badge" style={{ color: aqiColor(days[todayIdx].aqi) }}>
            Today: {days[todayIdx].aqi} · {currentStatus || aqiLabel(days[todayIdx].aqi)}
          </span>
        )}
      </div>

      <div className="trend-chart-wrap" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="120"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={days[todayIdx] ? aqiColor(days[todayIdx].aqi) : "#38bdf8"} stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#trend-area-grad)" />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Animated line overlay */}
          <polyline
            points={animated ? points : `${toX(0)},${toY(days[0].aqi)} ${toX(0)},${toY(days[0].aqi)}`}
            fill="none"
            stroke={days[todayIdx] ? aqiColor(days[todayIdx].aqi) : "#38bdf8"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "points 1s cubic-bezier(0.4,0,0.2,1)", opacity: animated ? 1 : 0 }}
          />

          {/* Dots + hover areas */}
          {days.map((d, i) => {
            const cx = toX(i), cy = toY(d.aqi);
            const isToday = i === todayIdx;
            const isHovered = hoveredIdx === i;
            const col = aqiColor(d.aqi);

            return (
              <g key={i}>
                {/* Glow ring for today */}
                {isToday && (
                  <circle cx={cx} cy={cy} r="10" fill={col} opacity="0.15" />
                )}
                {/* Dot */}
                <circle
                  cx={cx} cy={cy}
                  r={isToday ? 6 : isHovered ? 5 : 4}
                  fill={col}
                  stroke="#0f172a"
                  strokeWidth="2"
                  style={{ transition: "r 0.2s", cursor: "pointer", filter: isToday ? `drop-shadow(0 0 4px ${col})` : "none" }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={cx - 28} y={cy - 34}
                      width="56" height="26"
                      rx="6"
                      fill="#1e293b"
                      stroke={col}
                      strokeWidth="1"
                    />
                    <text x={cx} y={cy - 25} textAnchor="middle" fill={col} fontSize="11" fontWeight="bold">
                      AQI {d.aqi}
                    </text>
                    <text x={cx} y={cy - 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">
                      {aqiLabel(d.aqi)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Day labels */}
        <div className="trend-day-labels">
          {days.map((d, i) => (
            <span
              key={i}
              className={`trend-day-label ${i === todayIdx ? "today" : ""}`}
              style={{ color: i === todayIdx ? aqiColor(d.aqi) : undefined }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
