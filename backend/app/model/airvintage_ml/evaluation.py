"""
airvintage_ml.evaluation
=========================
Shared evaluation metrics and visualization functions for all
6 AirVintage training notebooks.

Note: matplotlib and seaborn are lazy-imported inside plot functions
so this module can be safely imported in production (inference_router.py)
without requiring GUI libraries.
"""

import json
import os
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    explained_variance_score,
)

# ─── Plot Palette (no matplotlib import needed here) ─────────────────────────
PALETTE = {
    "primary"   : "#667eea",
    "secondary" : "#f093fb",
    "accent"    : "#4facfe",
    "positive"  : "#2ecc71",
    "warning"   : "#f5af19",
    "danger"    : "#e74c3c",
    "dark"      : "#2c3e50",
}


def _setup_plt():
    """Lazy-import matplotlib and apply plot defaults. Called inside each plot function."""
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.dpi"       : 120,
        "font.family"      : "DejaVu Sans",
        "axes.spines.top"  : False,
        "axes.spines.right": False,
        "axes.grid"        : True,
        "grid.alpha"       : 0.25,
        "grid.linestyle"   : "--",
    })
    return plt


# ─── Metrics ──────────────────────────────────────────────────────────────────

def compute_metrics(y_true, y_pred) -> dict:
    """
    Compute regression evaluation metrics.

    Returns
    -------
    dict with keys: MAE, RMSE, R2, EVS, MAPE
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    mae  = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2   = float(r2_score(y_true, y_pred))
    evs  = float(explained_variance_score(y_true, y_pred))

    # MAPE — safe against zero division
    mask = y_true != 0
    mape = float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.any() else float("nan")

    return {"MAE": round(mae, 4), "RMSE": round(rmse, 4),
            "R2": round(r2, 4), "EVS": round(evs, 4), "MAPE": round(mape, 2)}


def print_metrics_table(splits: dict) -> None:
    """
    Pretty-print metrics for multiple splits.

    Parameters
    ----------
    splits : dict of {split_name: metrics_dict}
             e.g. {"Train": {...}, "Val": {...}, "Test": {...}}
    """
    rows = []
    for split, m in splits.items():
        rows.append({"Split": split, **m})
    df = pd.DataFrame(rows).set_index("Split")
    print("\n" + "═" * 60)
    print(f"{'EVALUATION METRICS':^60}")
    print("═" * 60)
    print(df.to_string())
    print("═" * 60 + "\n")


# ─── Plots ────────────────────────────────────────────────────────────────────

def _save(fig, savepath):
    if savepath:
        Path(savepath).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(savepath, dpi=120, bbox_inches="tight")


def plot_actual_vs_pred(
    y_true, y_pred, title: str = "Actual vs Predicted AQI",
    savepath: str = None, max_points: int = 5000,
) -> None:
    """Scatter plot of actual vs predicted values with a perfect prediction line."""
    plt = _setup_plt()
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    if len(y_true) > max_points:
        idx    = np.random.choice(len(y_true), max_points, replace=False)
        y_true = y_true[idx]
        y_pred = y_pred[idx]

    fig, ax = plt.subplots(figsize=(8, 7))
    ax.scatter(y_true, y_pred, alpha=0.25, s=10, color=PALETTE["primary"], label="Predictions")
    lim = [min(y_true.min(), y_pred.min()), max(y_true.max(), y_pred.max())]
    ax.plot(lim, lim, "--", color=PALETTE["danger"], lw=2, label="Perfect Prediction")
    ax.set_xlabel("Actual AQI", fontsize=12)
    ax.set_ylabel("Predicted AQI", fontsize=12)
    ax.set_title(title, fontsize=14, fontweight="bold", pad=15)
    ax.legend()

    r2 = r2_score(y_true, y_pred)
    ax.text(0.05, 0.90, f"R2 = {r2:.4f}", transform=ax.transAxes,
            fontsize=11, color=PALETTE["dark"],
            bbox=dict(boxstyle="round,pad=0.4", facecolor="white", alpha=0.8))

    plt.tight_layout()
    _save(fig, savepath)
    plt.show()


def plot_residuals(
    y_true, y_pred, title: str = "Residual Analysis",
    savepath: str = None, max_points: int = 5000,
) -> None:
    """Two-panel residual analysis: distribution + scatter vs predicted."""
    plt = _setup_plt()
    y_true    = np.asarray(y_true, dtype=float)
    y_pred    = np.asarray(y_pred, dtype=float)
    residuals = y_true - y_pred

    if len(residuals) > max_points:
        idx            = np.random.choice(len(residuals), max_points, replace=False)
        residuals_plot = residuals[idx]
        y_pred_plot    = y_pred[idx]
    else:
        residuals_plot = residuals
        y_pred_plot    = y_pred

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(title, fontsize=14, fontweight="bold")

    axes[0].hist(residuals_plot, bins=60, color=PALETTE["secondary"],
                 edgecolor="white", alpha=0.85)
    axes[0].axvline(0, color=PALETTE["danger"], linestyle="--", lw=2, label="Zero residual")
    axes[0].axvline(residuals.mean(), color=PALETTE["warning"], linestyle="-.", lw=1.5,
                    label=f"Mean={residuals.mean():.2f}")
    axes[0].set_xlabel("Residual (Actual - Predicted)")
    axes[0].set_ylabel("Count")
    axes[0].set_title("Residual Distribution")
    axes[0].legend()

    axes[1].scatter(y_pred_plot, residuals_plot, alpha=0.2, s=8, color=PALETTE["accent"])
    axes[1].axhline(0, color=PALETTE["danger"], linestyle="--", lw=2)
    axes[1].set_xlabel("Predicted AQI")
    axes[1].set_ylabel("Residual")
    axes[1].set_title("Residuals vs Predicted")

    plt.tight_layout()
    _save(fig, savepath)
    plt.show()


def plot_feature_importance(
    features: list, importances: np.ndarray,
    title: str = "Feature Importance", top_n: int = 20,
    savepath: str = None,
) -> None:
    """Horizontal bar chart of top-N feature importances."""
    plt = _setup_plt()
    df  = pd.DataFrame({"Feature": features, "Importance": importances})
    df  = df.sort_values("Importance", ascending=True).tail(top_n)

    fig, ax = plt.subplots(figsize=(10, max(6, top_n * 0.4)))
    colors  = plt.cm.viridis(np.linspace(0.2, 0.9, len(df)))
    ax.barh(df["Feature"], df["Importance"], color=colors)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_xlabel("Importance Score")
    plt.tight_layout()
    _save(fig, savepath)
    plt.show()


def plot_learning_curve_xgb(
    evals_result: dict,
    best_iteration: int = None,
    title: str = "XGBoost Learning Curve",
    savepath: str = None,
) -> None:
    """Plot XGBoost RMSE learning curve from evals_result dict."""
    plt = _setup_plt()
    fig, ax = plt.subplots(figsize=(12, 5))

    for set_name, metrics in evals_result.items():
        for metric_name, values in metrics.items():
            label = f"{set_name.replace('_', ' ').title()} - {metric_name.upper()}"
            color = PALETTE["primary"] if "train" in set_name.lower() else PALETTE["secondary"]
            ax.plot(values, label=label, color=color, lw=2)

    if best_iteration is not None:
        ax.axvline(best_iteration, color=PALETTE["danger"], linestyle="--",
                   label=f"Best iter: {best_iteration}")

    ax.set_xlabel("Boosting Round")
    ax.set_ylabel("RMSE")
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.legend()
    plt.tight_layout()
    _save(fig, savepath)
    plt.show()


def plot_learning_curve_lgb(
    model,
    title: str = "LightGBM Learning Curve",
    savepath: str = None,
) -> None:
    """Plot LightGBM learning curve from fitted model's evals_result."""
    plt = _setup_plt()
    try:
        evals = model.evals_result_
    except AttributeError:
        warnings.warn("Model has no evals_result_ attribute. Was eval_set provided during fit?")
        return

    fig, ax = plt.subplots(figsize=(12, 5))
    for dataset, metrics in evals.items():
        for metric_name, values in metrics.items():
            ax.plot(values, label=f"{dataset} - {metric_name}", lw=2)

    if hasattr(model, "best_iteration_") and model.best_iteration_ >= 0:
        ax.axvline(model.best_iteration_, color=PALETTE["danger"], linestyle="--",
                   label=f"Best iter: {model.best_iteration_}")

    ax.set_xlabel("Boosting Round")
    ax.set_ylabel("Metric")
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.legend()
    plt.tight_layout()
    _save(fig, savepath)
    plt.show()


# ─── Model Registry ───────────────────────────────────────────────────────────

def update_model_registry(
    registry_path: str,
    model_key: str,
    algorithm: str,
    dataset: str,
    test_metrics: dict,
    model_paths: dict,
    feature_count: int,
    notes: str = "",
) -> None:
    """
    Update the central model_registry.json with this model's metadata.

    Parameters
    ----------
    registry_path  : Path to model_registry.json.
    model_key      : Unique key, e.g. 'city_day', 'station_hour'.
    algorithm      : Algorithm name string.
    dataset        : Dataset filename.
    test_metrics   : dict from compute_metrics() on test set.
    model_paths    : dict of saved artifact paths.
    feature_count  : Number of input features.
    notes          : Optional free-form notes string.
    """
    Path(registry_path).parent.mkdir(parents=True, exist_ok=True)

    # Load existing registry
    if Path(registry_path).exists():
        with open(registry_path, "r") as f:
            registry = json.load(f)
    else:
        registry = {}

    registry[model_key] = {
        "algorithm"    : algorithm,
        "dataset"      : dataset,
        "feature_count": feature_count,
        "test_metrics" : test_metrics,
        "model_paths"  : model_paths,
        "notes"        : notes,
        "trained_at"   : datetime.utcnow().isoformat() + "Z",
        "version"      : "1.0.0",
    }

    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"✅ model_registry.json updated → [{model_key}]")
    print(f"   Algorithm : {algorithm}")
    print(f"   R²        : {test_metrics.get('R2', 'N/A')}")
    print(f"   RMSE      : {test_metrics.get('RMSE', 'N/A')}")
    print(f"   MAE       : {test_metrics.get('MAE', 'N/A')}")
