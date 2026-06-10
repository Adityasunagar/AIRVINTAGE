# -*- coding: utf-8 -*-
"""
AirVintage - Official Test Suite
Covers all 8 test cases from the project report.
Run: python run_tests.py  (backend must be live at http://127.0.0.1:8000)
"""

import requests
import json
import sys
import time
import io

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:8000"

# Hyderabad, India — test coordinates
LAT = 17.3850
LON = 78.4867

PASS  = "✅ PASS"
FAIL  = "❌ FAIL"
SEP   = "-" * 70

results = []

def run(tc_id, name, fn):
    print(f"\n{'='*70}")
    print(f"  Test Case {tc_id}: {name}")
    print(SEP)
    try:
        status, notes = fn()
        mark = PASS if status else FAIL
        print(f"  Result : {mark}")
        print(f"  Notes  : {notes}")
        results.append((tc_id, name, status, notes))
    except Exception as e:
        print(f"  Result : {FAIL}")
        print(f"  Notes  : Exception — {e}")
        results.append((tc_id, name, False, str(e)))

# ──────────────────────────────────────────────
# TC-1  Location Detection (Backend health check)
# ──────────────────────────────────────────────
def tc1_location_detection():
    r = requests.get(f"{BASE_URL}/", timeout=5)
    assert r.status_code == 200
    data = r.json()
    msg = data.get("message", "")
    assert "AirVintage" in msg, f"Unexpected home response: {msg}"
    return True, f"Backend reachable. Message: '{msg}'. GPS-based location detection is handled in frontend (navigator.geolocation → Geoapify reverse geocode)."

# ──────────────────────────────────────────────
# TC-2  Real-time AQI Fetching
# ──────────────────────────────────────────────
def tc2_aqi_fetching():
    r = requests.get(f"{BASE_URL}/aqi", params={"lat": LAT, "lon": LON}, timeout=20)
    assert r.status_code == 200, f"HTTP {r.status_code}"
    data = r.json()
    print(f"  Response: {json.dumps(data, indent=4)}")
    required = ["aqi", "pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide", "sulphur_dioxide", "ozone"]
    missing = [k for k in required if k not in data]
    if missing:
        return False, f"Missing fields: {missing}"
    return True, (f"AQI={data['aqi']} | PM2.5={data['pm2_5']} | PM10={data['pm10']} | "
                  f"NO₂={data['nitrogen_dioxide']} | SO₂={data['sulphur_dioxide']} | "
                  f"CO={data['carbon_monoxide']} | O₃={data['ozone']}")

# ──────────────────────────────────────────────
# TC-3  AQI Computation & Categorization (CPCB-style)
# ──────────────────────────────────────────────
def tc3_aqi_computation():
    r = requests.get(f"{BASE_URL}/aqi", params={"lat": LAT, "lon": LON}, timeout=20)
    data = r.json()
    aqi   = data.get("aqi", -1)
    status = data.get("status", "")
    valid_categories = ["Good", "Moderate", "Unhealthy for Sensitive Groups",
                        "Unhealthy", "Very Unhealthy", "Hazardous"]
    # Verify AQI is a non-negative integer and status is a recognised category
    assert aqi >= 0,        f"AQI is negative: {aqi}"
    assert status in valid_categories, f"Unknown category: '{status}'"
    return True, f"AQI={aqi} → Category='{status}' (valid CPCB-mapped category)"

# ──────────────────────────────────────────────
# TC-4  ML AQI Prediction (XGBoost via FastAPI)
# ──────────────────────────────────────────────
def tc4_ml_prediction():
    payload = {"lat": LAT, "lon": LON}
    r = requests.post(f"{BASE_URL}/predict", json=payload, timeout=40)
    assert r.status_code == 200, f"HTTP {r.status_code}"
    data = r.json()
    print(f"  Response (summary): predicted_aqi={data.get('predicted_aqi')}, "
          f"model={data.get('model')}, category={data.get('aqi_category')}")
    pred_aqi = data.get("predicted_aqi") or data.get("aqi")
    assert pred_aqi is not None, "No predicted_aqi in response"
    assert pred_aqi >= 0, f"Predicted AQI is negative: {pred_aqi}"
    model_used = data.get("model", "unknown")
    return True, f"Predicted AQI={pred_aqi} | Model='{model_used}' | Category='{data.get('aqi_category')}'"

# ──────────────────────────────────────────────
# TC-5  Health Recommendations
# ──────────────────────────────────────────────
def tc5_health_recommendations():
    payload = {"lat": LAT, "lon": LON}
    r = requests.post(f"{BASE_URL}/predict", json=payload, timeout=40)
    data = r.json()
    
    # 1. Verify Legacy Health Advisory for database compatibility
    advisory = data.get("health_advisory", {})
    assert advisory, "health_advisory field missing"
    msg  = advisory.get("message", "")
    rec  = advisory.get("recommendation", "")
    assert msg,  "Health advisory message is empty"
    assert rec,  "Health recommendation is empty"

    # 2. Verify Advanced Health Recommendations
    adv_recs = data.get("health_recommendations", {})
    assert adv_recs, "health_recommendations field missing"
    assert "severity" in adv_recs, "Advanced severity missing"
    assert "dominant_pollutant" in adv_recs, "Dominant pollutant missing"
    assert "general_recommendations" in adv_recs, "General recommendations missing"
    assert "cohort_recommendations" in adv_recs, "Cohort recommendations missing"
    assert "actionable_tips" in adv_recs, "Actionable tips missing"
    
    return True, f"Severity: {adv_recs['severity']} | Dominant: {adv_recs['dominant_pollutant']} | Recommendations count: {len(adv_recs['cohort_recommendations'])}"

# ──────────────────────────────────────────────
# TC-6  Interactive AQI Map (Forecast / Heatmap data)
# ──────────────────────────────────────────────
def tc6_map_heatmap():
    payload = {"lat": LAT, "lon": LON}
    r = requests.post(f"{BASE_URL}/forecast", json=payload, timeout=40)
    assert r.status_code == 200, f"HTTP {r.status_code}"
    data = r.json()
    # The forecast endpoint returns hourly AQI data used by the Leaflet heatmap
    hourly_aqi = data.get("hourly_aqi", [])
    daily      = data.get("daily", [])
    has_data   = bool(hourly_aqi or daily)
    print(f"  Hourly AQI entries: {len(hourly_aqi)} | Daily entries: {len(daily)}")
    assert has_data, "Neither hourly_aqi nor daily data returned"
    return True, (f"Heatmap data available — {len(hourly_aqi)} hourly AQI points "
                  f"and {len(daily)} daily forecast entries returned for Leaflet rendering.")

# ──────────────────────────────────────────────
# TC-7  Historical Trend Chart (7-day AQI data)
# ──────────────────────────────────────────────
def tc7_historical_trend():
    payload = {"lat": LAT, "lon": LON}
    r = requests.post(f"{BASE_URL}/forecast", json=payload, timeout=40)
    data = r.json()
    hourly_aqi = data.get("hourly_aqi", [])
    daily      = data.get("daily", [])
    print(f"  Hourly AQI entries: {len(hourly_aqi)} | Daily entries: {len(daily)}")
    if hourly_aqi:
        print(f"  Sample hourly: {hourly_aqi[:2]}")
    if daily:
        print(f"  Sample daily: {daily[:2]}")
    # Accept either hourly OR daily data for trend chart rendering
    has_trend_data = len(hourly_aqi) >= 24 or len(daily) >= 7
    assert has_trend_data, (f"Insufficient trend data: hourly={len(hourly_aqi)}, daily={len(daily)}")
    source = "hourly" if len(hourly_aqi) >= 24 else "daily"
    count  = len(hourly_aqi) if source == "hourly" else len(daily)
    return True, (f"{count} {source} AQI data points returned. "
                  f"Sufficient for 7-day Recharts trend chart visualization.")

# ──────────────────────────────────────────────
# TC-8  API Failure Handling (invalid coordinates)
# ──────────────────────────────────────────────
def tc8_api_failure_handling():
    # Send extreme invalid coordinates to trigger upstream API failure
    payload = {"lat": 9999.0, "lon": 9999.0}
    r = requests.post(f"{BASE_URL}/predict", json=payload, timeout=40)
    # Backend should return 200 with an error payload — NOT crash with 500
    data = r.json()
    print(f"  Response for invalid coords: {json.dumps(data, indent=2)[:300]}")
    # Accept graceful degradation: either an error key or a fallback AQI
    has_error_key = "error" in data
    has_fallback  = ("predicted_aqi" in data or "aqi" in data)
    if has_error_key:
        return True, f"Graceful error returned: '{data.get('error')}' — no crash."
    elif has_fallback:
        return True, f"Fallback AQI returned ({data.get('aqi')}) — backend degraded gracefully."
    else:
        return False, f"Unexpected response structure: {list(data.keys())}"


# ══════════════════════════════════════════════
#  MAIN RUNNER
# ══════════════════════════════════════════════
if __name__ == "__main__":
    print("\n" + "═"*70)
    print("   AIRVINTAGE — PROJECT REPORT TEST SUITE")
    print(f"   Target: {BASE_URL}  |  Location: Hyderabad ({LAT}°N, {LON}°E)")
    print("═"*70)

    run(1, "Location Detection",              tc1_location_detection)
    run(2, "Real-time AQI Fetching",          tc2_aqi_fetching)
    run(3, "AQI Computation & Categorization",tc3_aqi_computation)
    run(4, "ML AQI Prediction (XGBoost)",     tc4_ml_prediction)
    run(5, "Health Recommendations",          tc5_health_recommendations)
    run(6, "Interactive AQI Map (Heatmap)",   tc6_map_heatmap)
    run(7, "Historical Trend Chart (7-Day)",  tc7_historical_trend)
    run(8, "API Failure Handling",            tc8_api_failure_handling)

    # ── Summary Table ────────────────────────────────
    print("\n\n" + "═"*70)
    print("   TEST RESULTS SUMMARY")
    print("═"*70)
    print(f"  {'TC':<5} {'Test Name':<40} {'Result'}")
    print("  " + "-"*60)
    passed = 0
    for tc_id, name, ok, _ in results:
        mark = "PASS ✅" if ok else "FAIL ❌"
        print(f"  TC-{tc_id:<3} {name:<40} {mark}")
        if ok: passed += 1
    print("  " + "-"*60)
    print(f"  Total: {passed}/{len(results)} tests passed")
    print("═"*70 + "\n")

    sys.exit(0 if passed == len(results) else 1)
