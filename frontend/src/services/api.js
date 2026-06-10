/**
 * api.js — Centralised API service layer
 * All backend calls go through this module so the base URL is configured once.
 */

const API_BASE = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Fetch live AQI + ML prediction + weather data for given coordinates. */
export async function fetchPredict(lat, lon) {
  return apiFetch("/predict", {
    method: "POST",
    body: JSON.stringify({ lat, lon }),
  });
}

/** Fetch 7-day weather + air quality forecast for given coordinates. */
export async function fetchForecast(lat, lon) {
  return apiFetch("/forecast", {
    method: "POST",
    body: JSON.stringify({ lat, lon }),
  });
}

/** Fetch AQI trend / historical data. */
export async function fetchAqi(lat, lon) {
  return apiFetch(`/aqi?lat=${lat}&lon=${lon}`);
}

/** Fetch current weather data. */
export async function fetchWeather(lat, lon) {
  return apiFetch(`/weather?lat=${lat}&lon=${lon}`);
}

/** Fetch environment news articles. */
export async function fetchNews(region = "world", category = "") {
  return apiFetch(
    `/news?region=${encodeURIComponent(region)}&category=${encodeURIComponent(category)}`
  );
}

/** Fetch a single news article by ID. */
export async function fetchArticle(id) {
  return apiFetch(`/news/${id}`);
}

export default API_BASE;
