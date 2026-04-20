"""
AirVintage ML Package
=====================
Shared utilities for the AirVintage multi-model production pipeline.

Models:
  01 - City Day         (XGBoost)
  02 - Station Day      (RF + LightGBM Ensemble)
  03 - City Hour        (LightGBM)
  04 - Station Hour     (CatBoost)
  05 - Air Weather      (XGBoost, weather-aware)
  06 - Station Geo Router (KNN)
"""

__version__ = "1.0.0"
__author__  = "AirVintage ML Team"

from .aqi_utils      import aqi_to_bucket, health_advisory, POLLUTANT_COLS, WEATHER_COLS, AQI_LIMITS, AQI_COLORS
from .preprocessing  import (
    add_temporal_features,
    add_pollutant_interactions,
    add_weather_features,
    encode_categorical,
    fillna_production,
    add_entity_stats,
)
from .evaluation import (
    compute_metrics,
    plot_actual_vs_pred,
    plot_residuals,
    plot_feature_importance,
    plot_learning_curve_lgb,
    plot_learning_curve_xgb,
    print_metrics_table,
    update_model_registry,
)

__all__ = [
    "aqi_to_bucket", "health_advisory", "POLLUTANT_COLS", "WEATHER_COLS", "AQI_LIMITS", "AQI_COLORS",
    "add_temporal_features", "add_pollutant_interactions", "add_weather_features",
    "encode_categorical", "fillna_production", "add_entity_stats",
    "compute_metrics", "plot_actual_vs_pred", "plot_residuals",
    "plot_feature_importance", "plot_learning_curve_lgb", "plot_learning_curve_xgb",
    "print_metrics_table", "update_model_registry",
]
