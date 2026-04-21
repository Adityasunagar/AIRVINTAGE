import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Major Indian cities with coordinates
const POPULAR_LOCATIONS = [
  { name: 'Delhi',     lat: 28.7041, lng: 77.1025 },
  { name: 'Mumbai',    lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai',   lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata',   lat: 22.5726, lng: 88.3639 },
  { name: 'Pune',      lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Jaipur',    lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow',   lat: 26.8467, lng: 80.9462 },
];

function getAQIColor(aqi) {
  if (!aqi || aqi === 0) return '#60a5fa';
  if (aqi <= 50)  return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#dc2626';
}

function getAQILabel(aqi) {
  if (!aqi || aqi === 0) return 'No Data';
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy (Sensitive)';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export default function PopularLocationsAQI({ show = true, refreshKey = 0 }) {
  const [locationsAQI, setLocationsAQI] = useState([]);

  useEffect(() => {
    if (!show) {
      setLocationsAQI([]);
      return;
    }

    async function fetchAll() {
      // Fetch all cities in parallel from our own free backend
      const results = await Promise.all(
        POPULAR_LOCATIONS.map(async (loc) => {
          try {
            const res = await fetch(`http://127.0.0.1:8000/predict`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat: loc.lat, lon: loc.lng })
            });
            if (!res.ok) return null;
            const data = await res.json();
            const aqi = data?.aqi ?? 0;
            if (aqi <= 0) return null;
            return { ...loc, aqi, color: getAQIColor(aqi), status: data?.status ?? '' };
          } catch {
            return null;
          }
        })
      );

      setLocationsAQI(results.filter(Boolean));
    }

    fetchAll();
  }, [show, refreshKey]);

  if (!show) return null;

  return (
    <>
      {locationsAQI.map((loc) => (
        <Marker
          key={loc.name}
          position={[loc.lat, loc.lng]}
          icon={L.divIcon({
            className: '',
            iconSize: [46, 46],
            iconAnchor: [23, 23],
            popupAnchor: [0, -24],
            html: `
              <div style="
                background:${loc.color};
                border:2.5px solid rgba(255,255,255,0.9);
                border-radius:50%;
                width:46px; height:46px;
                display:flex; align-items:center; justify-content:center;
                font-family:'Outfit',sans-serif;
                font-weight:700; color:white; font-size:12px;
                box-shadow:0 2px 10px rgba(0,0,0,0.35), 0 0 0 3px ${loc.color}44;
                text-shadow:0 1px 3px rgba(0,0,0,0.4);
              ">${loc.aqi}</div>
            `,
          })}
        >
          <Popup className="aqi-popup">
            <div className="aqi-popup-inner">
              <div className="aqi-popup-city" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {loc.name}
              </div>
              <div className="aqi-popup-score" style={{ color: loc.color, fontSize: '22px', fontWeight: 'bold' }}>
                {loc.aqi}
              </div>
              <div style={{ color: loc.color, fontSize: '12px', fontWeight: 600 }}>
                {getAQILabel(loc.aqi)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
