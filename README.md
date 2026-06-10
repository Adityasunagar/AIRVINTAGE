# 🌬️ AirVintage — Hyper-Local Air Quality & ML Inference Platform

AirVintage is a production-grade, real-time environmental health monitoring platform. It combines hyper-local air quality tracking, advanced weather-aware machine learning predictions, cohort-specific health recommendation engines, and full-screen geospatial heatmaps into a premium, glassmorphism-themed user interface.

---

## 🔑 Key Features

### 1. 🤖 Machine Learning Inference Engine
AirVintage features a production-grade ML gateway (`inference_router.py`) supporting **6 distinct machine learning models** that adapt based on input availability:
*   **Model 01 — City Day (XGBoost):** Predicts daily average AQI values at the city level.
*   **Model 02 — Station Day (RF + LightGBM Ensemble):** Weighted ensemble predicting daily station-level AQI.
*   **Model 03 — City Hour (LightGBM):** Real-time hourly AQI forecasting for target cities.
*   **Model 04 — Station Hour (CatBoost):** Highly precise hourly predictions for monitoring stations.
*   **Model 05 — Weather-Aware (XGBoost):** Best-in-class real-time model combining 6 active pollutants with 6 live weather metrics.
*   **Model 06 — Spatial Router (BallTree):** Employs a Scikit-Learn `BallTree` algorithm to map coordinate-level queries to the nearest active monitoring stations using Haversine distance.

### 2. 🌦️ Dynamic Weather Background System
*   Built with a custom React hook (`useWeatherBackground.js`) which normalizes condition strings and performs fuzzy matching against active weather states (Clear, Cloudy, Rainy, Storm, Fog).
*   **Performance Optimized:** Uses `requestAnimationFrame` for buttery-smooth DOM updates, CSS `contain` property for paint optimization, and debounces/caches updates to reduce GPU overhead by 60%.
*   **A11y Compliant:** Fully WCAG 2.1 Level AA compliant with strict `prefers-reduced-motion` media query support.

### 3. 👥 AI Cohort Health Advisory System
*   Instead of generic warnings, AirVintage generates cohort-specific actionable recommendations for sensitive groups: **Elderly**, **Children**, **Athletes**, and the **General Public**.
*   Analyzes combinations of current AQI levels, dominant pollutants (PM2.5, PM10, NO₂, CO, O₃, SO₂), temperature, and humidity.

### 4. 🗺️ Interactive Geospatial Maps & Trends
*   **Geospatial Dashboard:** Full-screen Leaflet interactive map featuring heatmap overlays (`leaflet-heatmap`), location search presets, custom coordinate panning, and GPS reverse geocoding via BigDataCloud.
*   **Historical Trends:** Dynamic, high-resolution charts built with Recharts displaying 7-day weather and air quality forecasts alongside hourly trends.

### 5. 📰 Curated News Aggregator
*   Concurrently aggregates environment and air quality news from GNews, The Guardian API, and Google News RSS.
*   Implements an in-memory caching layer (30-min TTL) to bypass API rate limits, with elegant fallbacks and an in-app article reader.

---

## 🛠️ Architecture & Tech Stack

```mermaid
graph TD
    A[React Frontend] -->|REST / JSON| B[FastAPI Backend]
    B -->|SQLAlchemy| C[(PostgreSQL / SQLite)]
    B -->|ML Inference| D[Inference Router]
    D -->|Spatial Query| E[BallTree Router]
    D -->|Predictions| F[XGBoost / LightGBM / CatBoost]
    B -->|Live Data| G[Open-Meteo & Air Quality APIs]
```

### Backend Tech Stack
*   **Core:** Python, FastAPI, Uvicorn
*   **ORM / Database:** SQLAlchemy (configured for PostgreSQL with SQLite fallback)
*   **Machine Learning:** XGBoost, LightGBM, CatBoost, Scikit-learn, Joblib, Pandas, NumPy
*   **Caching & Resiliency:** Concurrency-safe ThreadPoolExecutor, 15-minute HTTP rate limit cache

### Frontend Tech Stack
*   **Core:** React (v19), React Router (v7)
*   **Charts:** Recharts
*   **Maps:** Leaflet, React Leaflet, Heatmap.js
*   **Iconography & Styling:** Lucide React, CSS glassmorphic variables, responsive grids

---

## 🚀 Getting Started

Ensure you have **Python 3.9+** and **Node.js 18+** installed.

### 1. Backend Setup & Run

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    # Windows:
    python -m venv venv
    .\venv\Scripts\activate

    # macOS/Linux:
    python -m venv venv
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure environment variables. Copy `.env.example` to `.env` and configure your settings:
    ```env
    DATABASE_URL=postgresql://postgres:sage666@localhost:6969/airvintage
    GNEWS_API_KEY="your_gnews_key"
    GUARDIAN_API_KEY="your_guardian_key"
    ```
    > [!NOTE]
    > If `DATABASE_URL` is omitted, the backend automatically falls back to a local SQLite database (`airvintage.db`) created inside the `backend` folder.
5.  Start the FastAPI development server:
    ```bash
    python -m uvicorn app.main:app --reload
    ```
    The API will run at **`http://localhost:8000`**.

### 2. Frontend Setup & Run

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the React dev server:
    ```bash
    npm start
    ```
    The application will launch automatically in your browser at **`http://localhost:3000`**.

---

## 🧪 Official Test Suite

The project includes a robust testing suite running 8 test cases validating both backend logic and third-party API configurations:

To run tests (ensure the backend is running locally on port 8000 first):
```bash
cd backend
python scripts/run_tests.py
```

| Test Case | Name | Scope / Verification |
| :--- | :--- | :--- |
| **TC-1** | Location Detection | Verifies backend connectivity and baseline homepage responses. |
| **TC-2** | Real-time AQI Fetching | Checks raw pollutant parameters (PM2.5, PM10, CO, NO₂, O₃, SO₂) are successfully retrieved. |
| **TC-3** | AQI Computation & Categorization | Assures AQI values map to correct standard CPCB air quality categories. |
| **TC-4** | ML AQI Prediction | Confirms GPS coordinates auto-route to the best preloaded ML models. |
| **TC-5** | Health Recommendations | Validates the cohort advisory engine generates recommendations for sensitive groups. |
| **TC-6** | Interactive AQI Map | Asserts hourly AQI data points are properly formatted for Leaflet heatmap rendering. |
| **TC-7** | Historical Trend Chart | Ensures sufficient historical & forecasted data points exist for trend lines. |
| **TC-8** | API Failure Handling | Confirms backend degrades gracefully (returns fallbacks or errors) without crashing on invalid coords. |

---

## 📋 Production Readiness Checklist

- [x] **Rate Limiting:** IP-based rate limiting (120 requests/minute per client IP) implemented to prevent backend flooding.
- [x] **Database Optimization:** Lazy preloading of all 5 ML models at startup to avoid runtime request bottlenecks.
- [x] **Fail-safes:** API failures or timeouts dynamically fall back to cached values (Stale-While-Revalidate pattern).
- [x] **CORS Configuration:** Dynamic local network IP CORS detection to support mobile device debugging.
- [x] **Mobile Responsiveness:** Strict media query layouts preventing horizontal text overflows and content bleeds.