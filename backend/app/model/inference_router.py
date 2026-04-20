"""
AirVintage Production Inference Router
=======================================
Single-file gateway for all 6 AirVintage ML models.

Full Tech Stack:
  Frontend  : React (JS/HTML/CSS)
  Backend   : Python FastAPI
  Database  : PostgreSQL
  ML Models : XGBoost / LightGBM / CatBoost (this file)

Production Input Contract (all inputs from FREE APIs):
  Pollutants : PM2.5, PM10, NO2, SO2, CO, O3       ← OpenAQ / CPCB API
  Weather    : Temp_C, Humidity, Wind_Speed,
               Wind_Direction, Pressure_hPa, Rain_mm ← Open-Meteo / OWM
  Location   : city name  OR  station_id  OR  lat/lon
  Time       : datetime string (ISO 8601)
"""

import json
import os
import sys
import warnings
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

from airvintage_ml import (
    aqi_to_bucket, health_advisory,
    add_temporal_features, add_weather_features,
    encode_categorical, fillna_production,
)


# ─── Shared helper ────────────────────────────────────────────────────────────

def _compute_pollutant_interactions(row: pd.DataFrame) -> pd.DataFrame:
    """Compute derived pollutant features from the 6 core inputs (no extra API calls)."""
    row = row.copy()
    pm25 = row["PM2.5"].fillna(0)
    pm10 = row["PM10"].fillna(0)
    no2  = row["NO2"].fillna(0)
    so2  = row["SO2"].fillna(0)
    co   = row["CO"].fillna(0)
    o3   = row["O3"].fillna(0)
    row["PM_ratio"] = (pm25 / (pm10 + 1e-6)).clip(0, 10)
    row["Total_PM"] = pm25 + pm10
    row["NO2_SO2"]  = no2  + so2
    row["CO_O3"]    = co   * o3
    return row


# ─── Predictor Class ──────────────────────────────────────────────────────────

class AirVintagePredictor:
    """
    Production inference gateway for all 6 AirVintage ML models.

    Features:
    - Lazy model loading (only loads what's needed)
    - Zero silent failures — explicit errors with clear messages
    - Thread-safe for read-only inference
    - All predictions return consistent JSON-serializable dicts
    """

    def __init__(self, models_dir: str = "models", verbose: bool = True):
        self.models_dir = Path(models_dir)
        self.verbose    = verbose
        self._cache     = {}
        self._registry  = self._load_registry()
        self._load_geo_router()

        if self.verbose:
            print("AirVintagePredictor initialized")
            print(f"  models_dir : {self.models_dir.resolve()}")
            reg_keys = list(self._registry.keys())
            print(f"  registry   : {reg_keys}")

    # ── Internals ─────────────────────────────────────────────────────────────

    def _load_registry(self) -> dict:
        path = self.models_dir / "model_registry.json"
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return {}

    def _require_file(self, path: Path) -> Path:
        if not path.exists():
            raise FileNotFoundError(
                f"Model file not found: {path}\n"
                f"Run the corresponding training notebook first."
            )
        return path

    def _load_features(self, name: str) -> list:
        path = self._require_file(self.models_dir / name)
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else data.get("feature_cols", [])

    def _entity_stats_fill(self, row: pd.DataFrame, stats_df: pd.DataFrame,
                            entity_col: str, entity_val) -> pd.DataFrame:
        """Fill entity stats features from saved stats DataFrame."""
        row = row.copy()
        sr  = stats_df[stats_df[entity_col] == entity_val]
        stat_cols = [c for c in stats_df.columns if "_AQI_" in c]
        for col in stat_cols:
            row[col] = float(sr[col].values[0]) if len(sr) > 0 else 150.0
        return row

    def _build_result(self, aqi: float, model_key: str, **kwargs) -> dict:
        """Standard output shape for all predictions."""
        aqi    = round(float(aqi), 2)
        bucket = aqi_to_bucket(aqi)
        return {
            "model"           : model_key,
            "predicted_aqi"   : aqi,
            "aqi_category"    : bucket,
            "health_advisory" : health_advisory(bucket),
            **kwargs,
        }

    # ── Geo Router ────────────────────────────────────────────────────────────

    def _load_geo_router(self):
        idx_path = self.models_dir / "06_geo_router_index.json"
        bt_path  = self.models_dir / "06_geo_router_balltree.pkl"
        gc_path  = self.models_dir / "06_geo_station_coords.csv"

        if idx_path.exists():
            with open(idx_path) as f:
                idx = json.load(f)
            self._city_index  = idx.get("active_city_to_stations", idx.get("city_to_stations", {}))
            self._stn_meta    = idx.get("station_metadata", {})
        else:
            self._city_index = {}
            self._stn_meta   = {}

        if bt_path.exists():
            self._balltree = joblib.load(bt_path)
            self._geo_df   = pd.read_csv(gc_path) if gc_path.exists() else pd.DataFrame()
        else:
            self._balltree = None
            self._geo_df   = pd.DataFrame()

    def route_city(self, city: str) -> dict:
        """Map city name → best matching active station."""
        q = city.strip().lower()
        if q in self._city_index:
            sids = self._city_index[q]
            by   = "exact"
        else:
            fuzzy = [c for c in self._city_index if q in c or c in q]
            if fuzzy:
                sids = self._city_index[fuzzy[0]]
                by   = f"fuzzy:{fuzzy[0]}"
            else:
                return {"station_id": None, "matched_by": "no_match"}
        sid  = sids[0]
        meta = self._stn_meta.get(sid, {})
        return {"station_id": sid, "station_name": meta.get("StationName", ""),
                "city": meta.get("City", city), "state": meta.get("State", ""),
                "matched_by": by}

    def route_latlon(self, lat: float, lon: float, k: int = 3) -> dict:
        """Find k nearest stations by GPS coordinates (haversine)."""
        if self._balltree is None or self._geo_df.empty:
            raise RuntimeError("Geo router not built. Run model_06_station_geo_router.ipynb first.")
        query      = np.deg2rad([[lat, lon]])
        dists, idx = self._balltree.query(query, k=min(k, len(self._geo_df)))
        R          = 6371.0
        results    = []
        for d, i in zip(dists[0], idx[0]):
            row = self._geo_df.iloc[i]
            results.append({
                "station_id"  : str(row["StationId"]),
                "station_name": str(row["StationName"]),
                "city"        : str(row["City"]),
                "state"       : str(row["State"]),
                "distance_km" : round(d * R, 2),
            })
        return {"nearest_station": results[0]["station_id"],
                "station_name"   : results[0]["station_name"],
                "city"           : results[0]["city"],
                "state"          : results[0]["state"],
                "distance_km"    : results[0]["distance_km"],
                "k_nearest"      : results}

    # ── Model 01: City Day ────────────────────────────────────────────────────

    def _load_01(self):
        if "city_day" not in self._cache:
            import xgboost as xgb
            m = xgb.XGBRegressor()
            m.load_model(str(self._require_file(self.models_dir / "01_city_day_xgb.json")))
            self._cache["city_day"] = {
                "model"  : m,
                "le"     : joblib.load(self._require_file(self.models_dir / "01_city_day_le_city.pkl")),
                "stats"  : pd.read_csv(self._require_file(self.models_dir / "01_city_day_city_stats.csv")),
                "features": self._load_features("01_city_day_features.json"),
            }
        return self._cache["city_day"]

    def predict_city_day(
        self, city: str, date: str,
        pm25: float, pm10: float,
        no2: float, so2: float, co: float, o3: float
    ) -> dict:
        """
        Predict daily AQI for a city.

        Inputs (all from free APIs):
          city       : city name (e.g. 'Delhi')
          date       : 'YYYY-MM-DD'
          pm25, pm10 : ug/m3 — OpenAQ / CPCB
          no2, so2   : ug/m3 — OpenAQ / CPCB
          co         : mg/m3 — OpenAQ / CPCB
          o3         : ug/m3 — OpenAQ / CPCB
        """
        c   = self._load_01()
        row = pd.DataFrame([{"City": city, "Date": date,
                              "PM2.5": pm25, "PM10": pm10,
                              "NO2": no2, "SO2": so2, "CO": co, "O3": o3}])
        row["Date"] = pd.to_datetime(row["Date"])
        row = add_temporal_features(row, "Date")
        row = _compute_pollutant_interactions(row)
        le  = c["le"]
        enc = int(le.transform([city])[0]) if city in le.classes_ else -1
        row["City_encoded"] = enc
        row = self._entity_stats_fill(row, c["stats"], "City_encoded", enc)
        X   = row[c["features"]].fillna(0)
        aqi = float(c["model"].predict(X)[0])
        return self._build_result(aqi, "city_day", city=city, date=date)

    # ── Model 02: Station Day ─────────────────────────────────────────────────

    def _load_02(self):
        if "station_day" not in self._cache:
            import lightgbm as lgb
            with open(self._require_file(self.models_dir / "02_station_day_ensemble_weights.json")) as f:
                w = json.load(f)
            self._cache["station_day"] = {
                "rf"      : joblib.load(self._require_file(self.models_dir / "02_station_day_rf.pkl")),
                "lgb"     : lgb.Booster(model_file=str(self._require_file(self.models_dir / "02_station_day_lgb.txt"))),
                "le"      : joblib.load(self._require_file(self.models_dir / "02_station_day_le_station.pkl")),
                "stats"   : pd.read_csv(self._require_file(self.models_dir / "02_station_day_stn_stats.csv")),
                "features": self._load_features("02_station_day_features.json"),
                "w_rf"    : w["w_rf"], "w_lgb": w["w_lgb"],
            }
        return self._cache["station_day"]

    def predict_station_day(
        self, station_id: str, date: str,
        pm25: float, pm10: float,
        no2: float, so2: float, co: float, o3: float
    ) -> dict:
        """Predict daily AQI for a monitoring station."""
        c   = self._load_02()
        row = pd.DataFrame([{"StationId": station_id, "Date": date,
                              "PM2.5": pm25, "PM10": pm10,
                              "NO2": no2, "SO2": so2, "CO": co, "O3": o3}])
        row["Date"] = pd.to_datetime(row["Date"])
        row = add_temporal_features(row, "Date")
        row = _compute_pollutant_interactions(row)
        le  = c["le"]
        enc = int(le.transform([station_id])[0]) if station_id in le.classes_ else -1
        row["StationId_encoded"] = enc
        row = self._entity_stats_fill(row, c["stats"], "StationId_encoded", enc)
        X   = row[c["features"]].fillna(0)
        aqi = float(c["w_rf"] * c["rf"].predict(X)[0] +
                    c["w_lgb"] * c["lgb"].predict(X)[0])
        return self._build_result(aqi, "station_day", station_id=station_id, date=date)

    # ── Model 03: City Hour ───────────────────────────────────────────────────

    def _load_03(self):
        if "city_hour" not in self._cache:
            import lightgbm as lgb
            self._cache["city_hour"] = {
                "model"  : lgb.Booster(model_file=str(self._require_file(self.models_dir / "03_city_hour_lgb.txt"))),
                "le"     : joblib.load(self._require_file(self.models_dir / "03_city_hour_le_city.pkl")),
                "stats"  : pd.read_csv(self._require_file(self.models_dir / "03_city_hour_city_stats.csv")),
                "features": self._load_features("03_city_hour_features.json"),
            }
        return self._cache["city_hour"]

    def predict_city_hour(
        self, city: str, datetime_str: str,
        pm25: float, pm10: float,
        no2: float, so2: float, co: float, o3: float
    ) -> dict:
        """Predict hourly AQI for a city."""
        c   = self._load_03()
        row = pd.DataFrame([{"City": city, "Datetime": datetime_str,
                              "PM2.5": pm25, "PM10": pm10,
                              "NO2": no2, "SO2": so2, "CO": co, "O3": o3}])
        row["Datetime"] = pd.to_datetime(row["Datetime"])
        row = add_temporal_features(row, "Datetime")
        row = _compute_pollutant_interactions(row)
        le  = c["le"]
        enc = int(le.transform([city])[0]) if city in le.classes_ else -1
        row["City_encoded"] = enc
        row = self._entity_stats_fill(row, c["stats"], "City_encoded", enc)
        X   = row[c["features"]].fillna(0)
        aqi = float(c["model"].predict(X)[0])
        return self._build_result(aqi, "city_hour", city=city, datetime=datetime_str)

    # ── Model 04: Station Hour ────────────────────────────────────────────────

    def _load_04(self):
        if "station_hour" not in self._cache:
            from catboost import CatBoostRegressor
            m = CatBoostRegressor()
            m.load_model(str(self._require_file(self.models_dir / "04_station_hour_catboost.cbm")))
            with open(self._require_file(self.models_dir / "04_station_hour_features.json")) as f:
                fc = json.load(f)
            self._cache["station_hour"] = {
                "model"   : m,
                "le"      : joblib.load(self._require_file(self.models_dir / "04_station_hour_le_stn.pkl")),
                "stats"   : pd.read_csv(self._require_file(self.models_dir / "04_station_hour_stn_stats.csv")),
                "features": fc if isinstance(fc, list) else fc["feature_cols"],
                "cat_idx" : fc if isinstance(fc, list) else fc.get("cat_idx", [0]),
            }
        return self._cache["station_hour"]

    def predict_station_hour(
        self, station_id: str, datetime_str: str,
        pm25: float, pm10: float,
        no2: float, so2: float, co: float, o3: float
    ) -> dict:
        """Predict hourly AQI for a monitoring station."""
        from catboost import Pool
        c   = self._load_04()
        row = pd.DataFrame([{"StationId": str(station_id), "Datetime": datetime_str,
                              "PM2.5": pm25, "PM10": pm10,
                              "NO2": no2, "SO2": so2, "CO": co, "O3": o3}])
        row["Datetime"] = pd.to_datetime(row["Datetime"])
        row = add_temporal_features(row, "Datetime")
        row = _compute_pollutant_interactions(row)
        le  = c["le"]
        enc = int(le.transform([str(station_id)])[0]) if str(station_id) in le.classes_ else -1
        row["StationId_encoded"] = enc
        row = self._entity_stats_fill(row, c["stats"], "StationId_encoded", enc)
        cat_idx  = c["cat_idx"] if isinstance(c["cat_idx"], list) else [0]
        num_feat = [f for f in c["features"] if f != "StationId"]
        row[num_feat] = row[num_feat].fillna(0)
        pool = Pool(row[c["features"]], cat_features=cat_idx)
        aqi  = float(c["model"].predict(pool)[0])
        return self._build_result(aqi, "station_hour", station_id=station_id, datetime=datetime_str)

    # ── Model 05: Weather-Aware ───────────────────────────────────────────────

    def _load_05(self):
        if "air_weather" not in self._cache:
            import xgboost as xgb
            m = xgb.XGBRegressor()
            m.load_model(str(self._require_file(self.models_dir / "05_air_weather_xgb.json")))
            self._cache["air_weather"] = {
                "model"  : m,
                "le"     : joblib.load(self._require_file(self.models_dir / "05_air_weather_le_station.pkl")),
                "stats"  : pd.read_csv(self._require_file(self.models_dir / "05_air_weather_stn_stats.csv")),
                "features": self._load_features("05_air_weather_features.json"),
            }
        return self._cache["air_weather"]

    def predict_weather_aware(
        self, station_id: str, datetime_str: str,
        # Pollutants — OpenAQ / CPCB free
        pm25: float, pm10: float, no2: float, so2: float, co: float, o3: float,
        # Weather — Open-Meteo / OpenWeatherMap free tier
        temp_c: float, humidity: float, wind_speed: float,
        wind_dir: float, pressure_hpa: float, rain_mm: float
    ) -> dict:
        """
        Best real-time model — uses both pollutant + weather data.
        All inputs available from free APIs.
        """
        c   = self._load_05()
        row = pd.DataFrame([{
            "Station_ID": str(station_id), "DateTime": datetime_str,
            "PM2.5": pm25, "PM10": pm10, "NO2": no2, "SO2": so2, "CO": co, "O3": o3,
            "Temp_C": temp_c, "Humidity": humidity, "Wind_Speed": wind_speed,
            "Wind_Direction": wind_dir, "Pressure_hPa": pressure_hpa, "Rain_mm": rain_mm,
        }])
        row["DateTime"] = pd.to_datetime(row["DateTime"])
        row = add_temporal_features(row, "DateTime")
        row = _compute_pollutant_interactions(row)
        row = add_weather_features(row)
        le  = c["le"]
        s   = str(station_id)
        enc = int(le.transform([s])[0]) if s in le.classes_ else -1
        row["Station_ID_encoded"] = enc
        row = self._entity_stats_fill(row, c["stats"], "Station_ID_encoded", enc)
        X   = row[c["features"]].fillna(0)
        aqi = float(c["model"].predict(X)[0])
        return self._build_result(
            aqi, "air_weather",
            station_id=station_id, datetime=datetime_str,
            weather={"temp_c": temp_c, "humidity": humidity,
                     "wind_speed": wind_speed, "rain_mm": rain_mm}
        )

    # ── Universal Predict ─────────────────────────────────────────────────────

    def predict(self, query_type: str, **kwargs) -> dict:
        """
        Universal router — call any model by name.

        query_type options:
          'city_day'     → city, date, pm25, pm10, no2, so2, co, o3
          'station_day'  → station_id, date, pm25, pm10, no2, so2, co, o3
          'city_hour'    → city, datetime, pm25, pm10, no2, so2, co, o3
          'station_hour' → station_id, datetime, pm25, pm10, no2, so2, co, o3
          'air_weather'  → station_id, datetime, pm25, pm10, no2, so2, co, o3,
                           temp_c, humidity, wind_speed, wind_dir, pressure_hpa, rain_mm
        """
        dispatch = {
            "city_day"    : lambda: self.predict_city_day(
                kwargs["city"], kwargs["date"],
                kwargs["pm25"], kwargs["pm10"],
                kwargs["no2"],  kwargs["so2"], kwargs["co"], kwargs["o3"]),
            "station_day" : lambda: self.predict_station_day(
                kwargs["station_id"], kwargs["date"],
                kwargs["pm25"], kwargs["pm10"],
                kwargs["no2"],  kwargs["so2"], kwargs["co"], kwargs["o3"]),
            "city_hour"   : lambda: self.predict_city_hour(
                kwargs["city"], kwargs["datetime"],
                kwargs["pm25"], kwargs["pm10"],
                kwargs["no2"],  kwargs["so2"], kwargs["co"], kwargs["o3"]),
            "station_hour": lambda: self.predict_station_hour(
                kwargs["station_id"], kwargs["datetime"],
                kwargs["pm25"], kwargs["pm10"],
                kwargs["no2"],  kwargs["so2"], kwargs["co"], kwargs["o3"]),
            "air_weather" : lambda: self.predict_weather_aware(
                kwargs["station_id"], kwargs["datetime"],
                kwargs["pm25"], kwargs["pm10"],
                kwargs["no2"],  kwargs["so2"], kwargs["co"], kwargs["o3"],
                kwargs["temp_c"], kwargs["humidity"], kwargs["wind_speed"],
                kwargs["wind_dir"], kwargs["pressure_hpa"], kwargs["rain_mm"]),
        }
        if query_type not in dispatch:
            raise ValueError(
                f"Unknown query_type '{query_type}'. "
                f"Choose from: {list(dispatch.keys())}"
            )
        return dispatch[query_type]()

    def predict_by_location(
        self, lat: float, lon: float, datetime_str: str,
        pm25: float, pm10: float, no2: float, so2: float, co: float, o3: float,
        temp_c: Optional[float] = None, humidity: Optional[float] = None,
        wind_speed: Optional[float] = None, wind_dir: Optional[float] = None,
        pressure_hpa: Optional[float] = None, rain_mm: Optional[float] = None,
        granularity: str = "hourly",
    ) -> dict:
        """
        Fully automatic GPS-based prediction.
        Routes to best available model based on available inputs.
        """
        geo    = self.route_latlon(lat, lon, k=3)
        sid    = geo["nearest_station"]
        has_wx = all(v is not None for v in [temp_c, humidity, wind_speed, wind_dir, pressure_hpa, rain_mm])

        if has_wx:
            result = self.predict_weather_aware(
                sid, datetime_str, pm25, pm10, no2, so2, co, o3,
                temp_c, humidity, wind_speed, wind_dir, pressure_hpa, rain_mm
            )
        elif granularity == "daily":
            result = self.predict_station_day(
                sid, datetime_str[:10], pm25, pm10, no2, so2, co, o3
            )
        else:
            result = self.predict_station_hour(
                sid, datetime_str, pm25, pm10, no2, so2, co, o3
            )

        result.update({
            "query_lat"     : lat,
            "query_lon"     : lon,
            "nearest_station": sid,
            "station_name"  : geo["station_name"],
            "nearest_city"  : geo["city"],
            "nearest_state" : geo["state"],
            "distance_km"   : geo["distance_km"],
        })
        return result

    def get_registry(self) -> dict:
        """Return model registry with metrics for all trained models."""
        return self._registry


# ─── FastAPI Integration Helper ───────────────────────────────────────────────

def create_predictor(models_dir: str = "models") -> AirVintagePredictor:
    """
    Factory function for FastAPI dependency injection.

    Usage in FastAPI:
        from inference_router import create_predictor
        predictor = create_predictor()

        @app.get("/predict/city")
        def predict_city(city: str, date: str, pm25: float, ...):
            return predictor.predict("city_day", city=city, date=date,
                                     pm25=pm25, ...)
    """
    return AirVintagePredictor(models_dir=models_dir, verbose=False)


# ─── CLI demo ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  AirVintage Inference Router — Quick Test")
    print("=" * 55)

    p = AirVintagePredictor("models/")

    # Test geo router (always available after notebook 06)
    r = p.route_city("Delhi")
    print(f"\nGeo router test:")
    print(f"  City='Delhi' -> station: {r.get('station_id')} | matched_by: {r.get('matched_by')}")

    r2 = p.route_latlon(28.6139, 77.2090, k=1)
    print(f"  GPS (28.6N, 77.2E) -> {r2.get('station_name')} ({r2.get('distance_km')} km)")

    print("\nTraining notebooks must be run before model predictions work.")
    print("Run order: 06 > 01 > 02 > 03 > 04 > 05")
    print("=" * 55)
