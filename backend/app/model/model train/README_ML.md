# AirVintage ML — Production Documentation

## Architecture Overview

AirVintage uses a **multi-model ML architecture** where 6 specialized models are
trained on different granularities of Indian air quality data. All models are
connected through a single `inference_router.py` gateway.

```
User Query (city / station / GPS)
         │
         ▼
┌─────────────────────┐
│  Geo Router (M06)   │  ← Finds nearest station, selects model
└────────┬────────────┘
         │
    ┌────┴─────────────────────────────────────┐
    │  Route by context                         │
    ├──────────────────────────────────────────┤
    │  City + Day      → Model 01 (XGBoost)    │
    │  Station + Day   → Model 02 (RF + LGB)   │
    │  City + Hour     → Model 03 (LightGBM)   │
    │  Station + Hour  → Model 04 (CatBoost)   │
    │  + Weather       → Model 05 (XGBoost)    │
    └──────────────────────────────────────────┘
         │
         ▼
    AQI Prediction + Category + Health Advisory
```

---

## Dataset → Model Mapping

| # | Notebook | Dataset | Algorithm | Rows | Key Features |
|---|----------|---------|-----------|------|--------------|
| 01 | `model_01_city_day.ipynb` | `city_day_cleaned.csv` | XGBoost + Optuna | ~25K | City × Day |
| 02 | `model_02_station_day.ipynb` | `station_day_cleaned.csv` | RF + LGB Ensemble | ~90K | Station × Day |
| 03 | `model_03_city_hour.ipynb` | `city_hour_cleaned.csv` | LightGBM + Optuna | ~650K | City × Hour + Rush flags |
| 04 | `model_04_station_hour.ipynb` | `station_hour_cleaned.csv` | CatBoost | ~2.2M | Station × Hour |
| 05 | `model_05_air_weather.ipynb` | `air_cleaned.csv` | XGBoost + Weather | 175K | Temp, Humidity, Wind, Pressure, Rain |
| 06 | `model_06_station_geo_router.ipynb` | `stations_cleaned.csv` | BallTree KNN | 230 stations | Geo routing |

---

## Shared Package: `airvintage_ml/`

All notebooks import from this shared package to ensure consistency:

| Module | Purpose |
|--------|---------|
| `aqi_utils.py` | AQI bucket thresholds (CPCB), pollutant/weather column lists |
| `preprocessing.py` | Feature engineering: temporal, pollutant interactions, weather |
| `evaluation.py` | Metrics, plots, model registry updater |

---

## Training Order

Run notebooks in this order (each saves artifacts needed by router):

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run notebooks in Jupyter
jupyter notebook
```

**Recommended order:**
1. `model_06_station_geo_router.ipynb`  ← Builds station network (fast, ~1 min)
2. `model_01_city_day.ipynb`            ← XGBoost + Optuna (~5 min)
3. `model_02_station_day.ipynb`         ← RF + LGB (~10 min)
4. `model_05_air_weather.ipynb`         ← XGBoost + Weather (~8 min)
5. `model_03_city_hour.ipynb`           ← LightGBM (~20 min, 650K rows)
6. `model_04_station_hour.ipynb`        ← CatBoost (~45 min, 2.2M rows)

---

## Inference Router Usage

```python
from inference_router import AirVintagePredictor

predictor = AirVintagePredictor(models_dir='models/')

pollutants = {
    'PM2.5': 90.0, 'PM10': 130.0, 'NO': 28.0, 'NO2': 45.0,
    'NOx': 73.0, 'NH3': 18.0, 'CO': 1.4, 'SO2': 12.0,
    'O3': 28.0, 'Benzene': 2.8, 'Toluene': 5.5, 'Xylene': 1.8,
}

# 1. City-level daily prediction
result = predictor.predict('city_day',
    city='Delhi', date='2025-01-15', pollutants=pollutants)

# 2. Station-level hourly prediction
result = predictor.predict('station_hour',
    station_id='AP001', datetime='2025-01-15 08:00:00', pollutants=pollutants)

# 3. Weather-aware prediction (most accurate)
result = predictor.predict('air_weather',
    station_id='1', datetime='2025-01-15 08:00:00', pollutants=pollutants,
    weather={'Temp_C': 26, 'Humidity': 70, 'Wind_Speed': 3.2,
             'Wind_Direction': 180, 'Pressure_hPa': 1012, 'Rain_mm': 0.0})

# 4. Fully automatic geo-routed (GPS coordinates)
result = predictor.predict_by_location(
    lat=28.6139, lon=77.2090,
    datetime_str='2025-01-15 08:00:00',
    pollutants=pollutants, weather={...}
)

# All results have the same shape:
print(result)
# {
#   'model': 'city_day_xgb',
#   'predicted_aqi': 182.5,
#   'aqi_category': 'Moderate',
#   'health_advisory': 'Sensitive individuals should...',
#   'city': 'Delhi',
#   ...
# }
```

---

## Saved Artifacts (after training)

```
models/
├── model_registry.json              ← Version + metrics for all 6 models
│
├── 01_city_day_xgb.json
├── 01_city_day_le_city.pkl
├── 01_city_day_city_stats.csv
├── 01_city_day_features.json
│
├── 02_station_day_rf.pkl
├── 02_station_day_lgb.txt
├── 02_station_day_le_station.pkl
├── 02_station_day_stn_stats.csv
├── 02_station_day_ensemble_weights.json
├── 02_station_day_features.json
│
├── 03_city_hour_lgb.txt
├── 03_city_hour_le_city.pkl
├── 03_city_hour_city_stats.csv
├── 03_city_hour_city_hour_stats.csv
├── 03_city_hour_features.json
│
├── 04_station_hour_catboost.cbm
├── 04_station_hour_le_stn.pkl
├── 04_station_hour_stn_stats.csv
├── 04_station_hour_sh_stats.csv
├── 04_station_hour_features.json
│
├── 05_air_weather_xgb.json
├── 05_air_weather_le_station.pkl
├── 05_air_weather_stn_stats.csv
├── 05_air_weather_features.json
│
├── 06_geo_router_index.json
├── 06_geo_router_balltree.pkl
├── 06_geo_station_coords.csv
└── 06_station_index.csv
```

---

## Feature Engineering (Shared)

### Temporal Features
All models use cyclic sin/cos encoding to handle periodicity correctly:
- `Hour_sin/cos` — Hour of day (0–23)
- `Month_sin/cos` — Month of year (1–12)
- `DOY_sin/cos` — Day of year (1–365)
- `DayOfWeek_sin/cos` — Day of week (0–6)
- `IsWeekend`, `IsRushHour`, `IsNight`, `IsMonsoon`, `IsWinter` — Binary flags

### Pollutant Interactions
- `PM_ratio` = PM2.5 / PM10 (fine-to-coarse particle ratio)
- `Total_PM` = PM2.5 + PM10
- `NOx_sum` = NO + NO2
- `NO2_SO2` = NO2 + SO2 (combustion signature)
- `Aromatic` = Benzene + Toluene + Xylene (VOC index)

### Weather Features (Model 05 only)
- `Wind_NS`, `Wind_EW` — Wind vector decomposition
- `Heat_Index` — Temperature × humidity combined effect
- `Pressure_norm` — Pressure deviation from standard (1013.25 hPa)
- `Is_Rainy`, `Is_Calm` — Binary meteorological flags

---

## Model Performance (approximate, before tuning)

| Model | Expected R² | Expected RMSE |
|-------|------------|---------------|
| City Day (XGBoost) | 0.95–0.98 | 12–20 AQI |
| Station Day (Ensemble) | 0.95–0.97 | 15–22 AQI |
| City Hour (LightGBM) | 0.93–0.97 | 15–25 AQI |
| Station Hour (CatBoost) | 0.92–0.96 | 18–28 AQI |
| Air Weather (XGBoost) | 0.97–0.99 | 5–12 AQI |

> Model 05 (Air Weather) achieves highest accuracy because it has complete weather context (no data gap between prediction and reality).
