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
// Fixed skeleton heights (avoids Math.random() causing re-render flicker)
const SKEL_HEIGHTS = [55, 38, 68, 42, 72, 30, 58];

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

    const base = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

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
      if (!data?.hourly) {
        setLoading(false);
        return;
      }

      // Group all hourly AQI values by date string
      const dailyMap = {};
      data.hourly.forEach((h) => {
        if (!h.time) return;
        const dateStr = h.time.split("T")[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = [];
        }
        if (h.aqi != null && h.aqi > 0) {
          dailyMap[dateStr].push(h.aqi);
        }
      });

      // Get today's local date string YYYY-MM-DD
      const localToday = new Date();
      const offset = localToday.getTimezoneOffset();
      const localTodayStr = new Date(localToday.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];

      // Sort all available dates
      const allDates = Object.keys(dailyMap).sort();

      // Find index of today's date
      const todayIdx = allDates.indexOf(localTodayStr);

      // Select target dates: past 7 days ending with today
      let targetDates = [];
      if (todayIdx !== -1) {
        targetDates = allDates.slice(Math.max(0, todayIdx - 6), todayIdx + 1);
      } else {
        // Fallback: take the 7 latest dates that are not in the future
        const pastDates = allDates.filter((d) => d <= localTodayStr);
        targetDates = pastDates.slice(-7);
      }

      // Aggregate each day to daily average
      const aggregated = targetDates.map((dateStr) => {
        const aqiValues = dailyMap[dateStr] || [];
        const avgAqi = aqiValues.length
          ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
          : null;

        // Parse date values directly to avoid timezone shift in parsing YYYY-MM-DD
        const parts = dateStr.split("-").map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        return { label, aqi: avgAqi, date: dateStr };
      });

      const filtered = aggregated.filter((d) => d.aqi != null);

      // Override Today's AQI with current live AQI if provided
      const finalTodayIdx = filtered.findIndex((d) => d.date === localTodayStr);
      if (currentAqi != null && finalTodayIdx !== -1) {
        filtered[finalTodayIdx].aqi = currentAqi;
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
          {SKEL_HEIGHTS.map((h, i) => (
            <div key={i} className="trend-skel-col">
              <div className="trend-skel-bar" style={{ height: `${h}%` }} />
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

  // Find today's index by matching the date string
  const localToday = new Date();
  const offset = localToday.getTimezoneOffset();
  const todayDateStr = new Date(localToday.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];
  const todayIdx = days.findIndex((d) => d.date && d.date.startsWith(todayDateStr));
  // Fallback: if none matched (e.g. timezone edge case), default to index 0
  const safeToday = todayIdx >= 0 ? todayIdx : 0;

  const toX = (i) => PAD + (i / (days.length - 1)) * (W - PAD * 2);
  const toY = (v) => H - PAD - ((v - minAqi) / (maxAqi - minAqi)) * (H - PAD * 2.5);

  // Build polyline points
  const points = days.map((d, i) => `${toX(i)},${toY(d.aqi)}`).join(" ");

  // Build area fill path
  const firstX = toX(0), lastX = toX(days.length - 1);
  const areaPath = `M${firstX},${H - PAD} ` +
    days.map((d, i) => `L${toX(i)},${toY(d.aqi)}`).join(" ") +
    ` L${lastX},${H - PAD} Z`;

  return (
    <div className="panel aqi-trend-card">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title">AQI Trend — 7 Days</span>
        {days[safeToday] && (
          <span className="trend-today-badge" style={{ color: aqiColor(days[safeToday].aqi) }}>
            Today: {days[safeToday].aqi} · {currentStatus || aqiLabel(days[safeToday].aqi)}
          </span>
        )}
      </div>

      <div className="trend-chart-wrap" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="120"
          style={{ overflow: "visible" }}
          onTouchStart={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="trend-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={days[safeToday] ? aqiColor(days[safeToday].aqi) : "#38bdf8"} stopOpacity="0.25" />
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
            stroke={days[safeToday] ? aqiColor(days[safeToday].aqi) : "#38bdf8"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "points 1s cubic-bezier(0.4,0,0.2,1)", opacity: animated ? 1 : 0 }}
          />

          {/* Dots + hover areas */}
          {days.map((d, i) => {
            const cx = toX(i), cy = toY(d.aqi);
            const isToday = i === safeToday;
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
                {/* Large invisible hover target */}
                <circle
                  cx={cx} cy={cy}
                  r="18"
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onTouchStart={(e) => { e.stopPropagation(); setHovered(i); }}
                />
                {/* Hover tooltip */}
                {isHovered && (
                  <g style={{ pointerEvents: 'none' }}>
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
          {/* Day labels directly inside SVG to ensure perfect alignment under scaling */}
          {days.map((d, i) => {
            const cx = toX(i);
            const isToday = i === safeToday;
            return (
              <text
                key={i}
                x={cx}
                y={H - 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight={isToday ? "800" : "600"}
                fill={isToday ? aqiColor(d.aqi) : "var(--text-3)"}
                style={{ transition: "fill 0.2s" }}
              >
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
