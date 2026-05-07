import React, { useEffect, useState } from "react";
import { useSmartRecommendations } from "../hooks/useSmartRecommendations";

// Advice sentences keyed to score range
function getAdviceText(score, category) {
  if (score >= 9) return "Perfect conditions. Enjoy outdoor activities freely — no precautions needed.";
  if (score >= 7) return "Great day to be outside. Light precautions may apply for sensitive individuals.";
  if (score >= 5) return "Moderate outdoor suitability. Limit prolonged exposure and stay hydrated.";
  if (score >= 3) return "Conditions are challenging. Outdoor activity not recommended for sensitive groups.";
  return "Unsafe outdoor conditions. Stay indoors and keep windows closed.";
}

// Map backend model keys → human-readable display info
// Keys match what inference_router.py returns in result["model"]
const MODEL_INFO_MAP = {
  "air_weather":  { name: "XGBoost",    algo: "Weather-Aware XGBoost",  confidence: 91 },
  "station_hour": { name: "CatBoost",   algo: "Station-Hour CatBoost",  confidence: 88 },
  "station_day":  { name: "RF + LightGBM", algo: "Station Ensemble",   confidence: 85 },
  "city_hour":    { name: "LightGBM",   algo: "City-Hour LightGBM",     confidence: 87 },
  "city_day":     { name: "XGBoost",    algo: "City-Day XGBoost",       confidence: 89 },
  "fallback_api": { name: "Heuristic",  algo: "Rule-based Fallback",    confidence: 72 },
};

// Read real model key from the API response; fallback gracefully if missing
function getModelInfo(aqiData) {
  if (!aqiData) return { name: "XGBoost", algo: "Weather-Aware XGBoost", confidence: 91 };
  const key = aqiData.model || "air_weather";
  return MODEL_INFO_MAP[key] || { name: key, algo: key, confidence: 85 };
}


const ALERT_TYPE_STYLES = {
  danger:  { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)",   color: "var(--danger)" },
  warning: { bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.4)",   color: "var(--warn)" },
  info:    { bg: "rgba(56,189,248,0.15)",  border: "rgba(56,189,248,0.4)",  color: "var(--accent)" },
  success: { bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.4)",   color: "var(--success)" },
};

export default function SmartRecommendationsCard({ aqiData, weatherData }) {
  const rec = useSmartRecommendations(aqiData, weatherData);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [rec]);

  if (!rec) return null;

  const { score, category, color, explanation, alerts } = rec;
  const model = getModelInfo(aqiData);
  const advice = getAdviceText(score, category);

  // SVG circle gauge
  const RADIUS = 36;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = animated ? ((score / 10) * CIRCUMFERENCE) : 0;
  const dash = `${progress} ${CIRCUMFERENCE}`;

  return (
    <div className="panel animate-in smart-rec-card">
      {/* Header */}
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="panel-title">Smart Recommendations</span>
        <span className="live-chip">
          <span className="live-dot-small" />
          AI-Powered
        </span>
      </div>

      {/* Main body */}
      <div className="smart-rec-body">

        {/* Score gauge */}
        <div className="score-gauge-wrap">
          <svg width="100" height="100" viewBox="0 0 100 100" className="score-ring-svg">
            {/* Track */}
            <circle
              cx="50" cy="50" r={RADIUS}
              fill="none"
              stroke="var(--panel-sep)"
              strokeWidth="8"
            />
            {/* Progress */}
            <circle
              cx="50" cy="50" r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={CIRCUMFERENCE * 0.25}
              style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color})` }}
              transform="rotate(-90 50 50)"
            />
            {/* Score text */}
            <text x="50" y="46" textAnchor="middle" fill={color} fontSize="20" fontWeight="bold" dominantBaseline="middle">
              {score}
            </text>
            <text x="50" y="62" textAnchor="middle" fill="var(--text-3)" fontSize="9" dominantBaseline="middle">
              / 10
            </text>
          </svg>
          <div className="score-label" style={{ color }}>
            {category}
          </div>
          <div className="score-sublabel">Outdoor Suitability</div>
        </div>

        {/* Advice + alerts */}
        <div className="smart-rec-right">
          {/* Today's Advice */}
          <div className="rec-advice-block">
            <div className="rec-advice-label">📋 Today's Advice</div>
            <p className="rec-advice-text">{advice}</p>
            {explanation && reasons_visible(explanation) && (
              <p className="rec-explanation">{explanation}</p>
            )}
          </div>

          {/* Alert pills */}
          {alerts.length > 0 && (
            <div className="alert-pills-row">
              {alerts.map((alert) => {
                const st = ALERT_TYPE_STYLES[alert.type] || ALERT_TYPE_STYLES.info;
                return (
                  <div
                    key={alert.id}
                    className="alert-pill"
                    style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}
                    title={alert.message}
                  >
                    <span className="alert-pill-icon">{alert.icon}</span>
                    <span className="alert-pill-label">{alert.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Model badge strip */}
      <div className="model-badge-strip">
        <span className="model-badge-icon">🤖</span>
        <span className="model-badge-text">
          Model: <strong>{model.algo}</strong>
        </span>
        <span className="model-badge-sep">·</span>
        <span className="model-badge-text">
          Confidence: <strong style={{ color: "var(--success)" }}>{model.confidence}%</strong>
        </span>
        <span className="model-badge-sep">·</span>
        <span className="model-badge-text" style={{ color: "var(--text-3)" }}>
          Updated live
        </span>
      </div>
    </div>
  );
}

function reasons_visible(explanation) {
  return explanation && !explanation.includes("Conditions are perfect");
}
