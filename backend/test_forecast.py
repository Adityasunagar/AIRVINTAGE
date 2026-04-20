import requests
import json

try:
    response = requests.post(
        "http://127.0.0.1:8000/forecast",
        json={"lat": 19.07, "lon": 72.87},
        timeout=5
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Daily count: {len(data.get('daily', []))}")
        print(f"Hourly count: {len(data.get('hourly', []))}")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
