"""
airvintage_ml.preprocessing
============================
Shared, production-grade feature engineering functions used by
all 6 AirVintage training notebooks and the inference router.

Design Principles
-----------------
- Pure functions: no side effects, always return a new DataFrame copy.
- Safe: handles missing columns gracefully with warnings.
- Consistent: every notebook calls the same functions → same feature space.
"""

import warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder


# ─── Temporal Features ────────────────────────────────────────────────────────

def add_temporal_features(df: pd.DataFrame, datetime_col: str) -> pd.DataFrame:
    """
    Extract and cyclically encode rich temporal features from a datetime column.

    Features added
    --------------
    Linear : Year, Month, DayOfYear, Hour (if sub-daily), Quarter,
             DayOfWeek, WeekOfYear
    Binary : IsWeekend, IsRushHour (7-9h, 17-19h), IsNight (22-4h),
             IsMonsoon (Jun-Sep), IsWinter (Nov-Feb)
    Cyclic : Month_sin/cos, DayOfYear_sin/cos, Hour_sin/cos (if hourly),
             DayOfWeek_sin/cos

    Parameters
    ----------
    df           : Input DataFrame (not modified).
    datetime_col : Name of the datetime column (str or Timestamp dtype).

    Returns
    -------
    pd.DataFrame with new temporal columns appended.
    """
    df = df.copy()

    if datetime_col not in df.columns:
        warnings.warn(f"[preprocessing] Column '{datetime_col}' not found. Skipping temporal features.")
        return df

    try:
        dt = pd.to_datetime(df[datetime_col], format="mixed", dayfirst=True)
    except ValueError:
        # Fallback for older pandas versions
        dt = pd.to_datetime(df[datetime_col], infer_datetime_format=True, dayfirst=True)

    df["Year"]        = dt.dt.year.astype("int16")
    df["Month"]       = dt.dt.month.astype("int8")
    df["DayOfYear"]   = dt.dt.dayofyear.astype("int16")
    df["Quarter"]     = dt.dt.quarter.astype("int8")
    df["DayOfWeek"]   = dt.dt.dayofweek.astype("int8")
    df["WeekOfYear"]  = dt.dt.isocalendar().week.astype("int8")
    df["IsWeekend"]   = (df["DayOfWeek"] >= 5).astype("int8")
    df["IsMonsoon"]   = df["Month"].isin([6, 7, 8, 9]).astype("int8")
    df["IsWinter"]    = df["Month"].isin([11, 12, 1, 2]).astype("int8")

    # Hour-level features (only if datetime has time component)
    has_time = (dt.dt.hour != 0).any() or (dt.dt.minute != 0).any()
    if has_time:
        df["Hour"]       = dt.dt.hour.astype("int8")
        df["IsRushHour"] = df["Hour"].isin([7, 8, 9, 17, 18, 19]).astype("int8")
        df["IsNight"]    = df["Hour"].isin([22, 23, 0, 1, 2, 3, 4]).astype("int8")
        df["IsMidnight"] = (df["Hour"] <= 3).astype("int8")

        # Cyclic hour encoding
        df["Hour_sin"]   = np.sin(2 * np.pi * df["Hour"] / 24).astype("float32")
        df["Hour_cos"]   = np.cos(2 * np.pi * df["Hour"] / 24).astype("float32")

    # Cyclic encodings for month, day-of-year, day-of-week
    df["Month_sin"]      = np.sin(2 * np.pi * df["Month"] / 12).astype("float32")
    df["Month_cos"]      = np.cos(2 * np.pi * df["Month"] / 12).astype("float32")
    df["DOY_sin"]        = np.sin(2 * np.pi * df["DayOfYear"] / 365).astype("float32")
    df["DOY_cos"]        = np.cos(2 * np.pi * df["DayOfYear"] / 365).astype("float32")
    df["DayOfWeek_sin"]  = np.sin(2 * np.pi * df["DayOfWeek"] / 7).astype("float32")
    df["DayOfWeek_cos"]  = np.cos(2 * np.pi * df["DayOfWeek"] / 7).astype("float32")

    return df


# ─── Pollutant Interaction Features ───────────────────────────────────────────

def add_pollutant_interactions(
    df: pd.DataFrame,
    pm25_col: str = "PM2.5",
    pm10_col: str = "PM10",
    no_col:   str = "NO",
    no2_col:  str = "NO2",
    so2_col:  str = "SO2",
    benz_col: str = "Benzene",
    tol_col:  str = "Toluene",
    xyl_col:  str = "Xylene",
) -> pd.DataFrame:
    """
    Create physically meaningful pollutant interaction features.

    Features added
    --------------
    PM_ratio    : PM2.5 / PM10  (fine-to-coarse particle ratio)
    Total_PM    : PM2.5 + PM10
    NOx_sum     : NO + NO2
    NO2_SO2     : NO2 + SO2     (combustion signature)
    Aromatic    : Benzene + Toluene + Xylene (VOC aromatic index)

    Parameters
    ----------
    df : Input DataFrame. Columns that don't exist are skipped silently.

    Returns
    -------
    pd.DataFrame with new interaction columns.
    """
    df = df.copy()

    def safe_col(col):
        return df[col] if col in df.columns else pd.Series(0.0, index=df.index)

    pm25 = safe_col(pm25_col).fillna(0)
    pm10 = safe_col(pm10_col).fillna(0)
    no   = safe_col(no_col).fillna(0)
    no2  = safe_col(no2_col).fillna(0)
    so2  = safe_col(so2_col).fillna(0)
    benz = safe_col(benz_col).fillna(0)
    tol  = safe_col(tol_col).fillna(0)
    xyl  = safe_col(xyl_col).fillna(0)

    df["PM_ratio"]  = (pm25 / (pm10 + 1e-6)).clip(0, 10).astype("float32")
    df["Total_PM"]  = (pm25 + pm10).astype("float32")
    df["NOx_sum"]   = (no + no2).astype("float32")
    df["NO2_SO2"]   = (no2 + so2).astype("float32")
    df["Aromatic"]  = (benz + tol + xyl).astype("float32")

    return df


# ─── Weather Features ──────────────────────────────────────────────────────────

def add_weather_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive meteorological interaction features from raw weather columns.

    Requires columns: Temp_C, Humidity, Wind_Speed, Wind_Direction,
                      Pressure_hPa, Rain_mm

    Features added
    --------------
    Wind_NS       : North-South wind component (Wind_Speed × cos(dir))
    Wind_EW       : East-West wind component  (Wind_Speed × sin(dir))
    Heat_Index    : Simplified heat index (Temp + Humidity effect)
    Pressure_norm : Pressure normalized to standard atmosphere (1013.25 hPa)
    Is_Rainy      : Binary flag (Rain_mm > 0.1)
    Is_Calm       : Binary flag (Wind_Speed < 1 m/s — stagnant air traps pollutants)

    Returns
    -------
    pd.DataFrame with new meteorological features.
    """
    df = df.copy()

    def get(col, default=0.0):
        return df[col].fillna(default) if col in df.columns else pd.Series(default, index=df.index)

    temp     = get("Temp_C")
    humidity = get("Humidity")
    ws       = get("Wind_Speed")
    wd_deg   = get("Wind_Direction")
    pressure = get("Pressure_hPa", 1013.25)
    rain     = get("Rain_mm")

    wd_rad = np.deg2rad(wd_deg)
    df["Wind_NS"]       = (ws * np.cos(wd_rad)).astype("float32")
    df["Wind_EW"]       = (ws * np.sin(wd_rad)).astype("float32")
    df["Heat_Index"]    = (temp + 0.33 * humidity / 100 * 6.105 *
                           np.exp(17.27 * temp / (237.7 + temp)) - 4.0).astype("float32")
    df["Pressure_norm"] = ((pressure - 1013.25) / 10.0).astype("float32")
    df["Is_Rainy"]      = (rain > 0.1).astype("int8")
    df["Is_Calm"]       = (ws < 1.0).astype("int8")

    return df


# ─── Categorical Encoding ─────────────────────────────────────────────────────

def encode_categorical(
    df: pd.DataFrame,
    col: str,
    encoder: LabelEncoder = None,
    unknown_value: int = -1,
) -> tuple[pd.DataFrame, LabelEncoder]:
    """
    Label-encode a categorical column with safe unknown handling.

    Parameters
    ----------
    df            : Input DataFrame.
    col           : Column to encode.
    encoder       : Existing fitted LabelEncoder (for inference). If None, fits new one.
    unknown_value : Integer to assign to unseen categories (default -1).

    Returns
    -------
    (df_with_encoded_col, fitted_encoder)
    The encoded column is named f"{col}_encoded".
    """
    df = df.copy()

    if col not in df.columns:
        warnings.warn(f"[preprocessing] Column '{col}' not found. Skipping encoding.")
        return df, encoder

    values = df[col].astype(str).fillna("UNKNOWN")

    if encoder is None:
        encoder = LabelEncoder()
        encoder.fit(values)

    known_mask = values.isin(encoder.classes_)
    encoded    = pd.Series(unknown_value, index=df.index, dtype="int32")
    encoded[known_mask] = encoder.transform(values[known_mask]).astype("int32")

    df[f"{col}_encoded"] = encoded
    return df, encoder


# ─── Missing Value Imputation ─────────────────────────────────────────────────

def fillna_production(
    df: pd.DataFrame,
    strategy: str = "median",
    fill_values: dict = None,
) -> pd.DataFrame:
    """
    Production-safe NaN imputation for numeric columns.

    Parameters
    ----------
    df          : Input DataFrame.
    strategy    : 'median' (default) or 'mean'.
    fill_values : Optional dict of {column: value} overrides.

    Returns
    -------
    pd.DataFrame with NaN filled.
    """
    df    = df.copy()
    num   = df.select_dtypes(include=[np.number]).columns.tolist()
    stats = df[num].median() if strategy == "median" else df[num].mean()
    df[num] = df[num].fillna(stats)

    if fill_values:
        for col, val in fill_values.items():
            if col in df.columns:
                df[col] = df[col].fillna(val)

    return df


# ─── Entity-Level Statistical Features ────────────────────────────────────────

def add_entity_stats(
    df: pd.DataFrame,
    entity_col: str,
    target_col: str = "AQI",
    group_also_by: str = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Add entity-level historical AQI statistics as features.

    Computes mean, std, median, q25, q75 of `target_col` grouped by `entity_col`
    (and optionally also by `group_also_by`, e.g., Hour).

    Returns
    -------
    (df_with_stats, stats_df)
    stats_df can be saved to disk and used at inference time.
    """
    df = df.copy()

    group_keys = [entity_col] if group_also_by is None else [entity_col, group_also_by]
    stat_funcs = {"mean": "mean", "std": "std", "median": "median",
                  "q25": lambda x: x.quantile(0.25), "q75": lambda x: x.quantile(0.75)}

    stats = df.groupby(group_keys)[target_col].agg(
        mean="mean", std="std", median="median",
        q25=lambda x: x.quantile(0.25), q75=lambda x: x.quantile(0.75)
    ).reset_index()

    prefix = "_".join(str(k) for k in group_keys)
    stats = stats.rename(columns={
        "mean":   f"{prefix}_AQI_mean",
        "std":    f"{prefix}_AQI_std",
        "median": f"{prefix}_AQI_median",
        "q25":    f"{prefix}_AQI_q25",
        "q75":    f"{prefix}_AQI_q75",
    })

    df = df.merge(stats, on=group_keys, how="left")
    return df, stats
