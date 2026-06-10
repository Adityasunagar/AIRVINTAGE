import { useEffect, useState, useRef } from 'react';
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

// ─── Module-level cache (survives re-renders & React Strict Mode) ───────────
// Key: city name → { data, fetchedAt }
// TTL: 15 minutes — same as the backend's API_CACHE
const CITY_CACHE = {};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isFresh(entry) {
  return entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
}

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

export default function PopularLocationsAQI({ show = true, refreshKey = 0, setCoordinates, setLocationName }) {
  const [locationsAQI, setLocationsAQI] = useState([]);
  // Track whether the component is still mounted to skip state updates after unmount
  const mountedRef = useRef(true);
  // AbortController ref so we can cancel in-flight fetches
  const abortRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!show) {
      setLocationsAQI([]);
      return;
    }

    // Cancel any previous fetch loop that's still running
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchAll() {
      // Seed UI immediately with whatever is already cached
      const cached = POPULAR_LOCATIONS
        .filter(loc => isFresh(CITY_CACHE[loc.name]))
        .map(loc => CITY_CACHE[loc.name].data);

      if (cached.length > 0 && mountedRef.current) {
        setLocationsAQI(cached);
      }

      // Only fetch cities whose cache is stale
      const stale = POPULAR_LOCATIONS.filter(loc => !isFresh(CITY_CACHE[loc.name]));

      const results = [...cached];

      for (const loc of stale) {
        if (controller.signal.aborted) break;

        // 300 ms stagger between requests — spreads load, avoids burst
        await new Promise(r => setTimeout(r, 300));
        if (controller.signal.aborted) break;

        try {
          // Use Open-Meteo air-quality API directly — this has its OWN
          // free quota separate from our backend /predict endpoint,
          // so it never competes with the user's dashboard data.
          const url =
            `https://air-quality-api.open-meteo.com/v1/air-quality` +
            `?latitude=${loc.lat}&longitude=${loc.lng}` +
            `&current=us_aqi,pm2_5&timezone=auto`;

          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) continue;

          const json = await res.json();
          const aqi = json?.current?.us_aqi ?? 0;
          if (aqi <= 0) continue;

          const entry = {
            ...loc,
            aqi,
            color: getAQIColor(aqi),
            status: getAQILabel(aqi),
            pm25: json?.current?.pm2_5 ?? null,
          };

          // Store in module-level cache
          CITY_CACHE[loc.name] = { data: entry, fetchedAt: Date.now() };

          // Replace any previously-cached version in the results array
          const idx = results.findIndex(r => r.name === loc.name);
          if (idx >= 0) results[idx] = entry;
          else results.push(entry);

          if (mountedRef.current) {
            setLocationsAQI([...results]);
          }
        } catch (err) {
          if (err.name === 'AbortError') break; // component unmounted
          // Other errors are silently skipped; stale cache keeps the marker visible
        }
      }
    }

    fetchAll();

    return () => {
      // Cancel the loop when show/refreshKey changes or component unmounts
      controller.abort();
    };
  }, [show, refreshKey]);

  if (!show) return null;

  return (
    <>
      {locationsAQI.map((loc) => (
        <Marker
          key={loc.name}
          position={[loc.lat, loc.lng]}
          eventHandlers={{
            click: () => {
              if (setCoordinates) setCoordinates({ lat: loc.lat, lon: loc.lng, accuracy: null });
              if (setLocationName) setLocationName({ city: loc.name, state: '', country: 'India' });
            },
          }}
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
                cursor:pointer;
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
              {loc.pm25 != null && (
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                  PM2.5: <span style={{ color: '#fff', fontWeight: 600 }}>{loc.pm25.toFixed(1)} µg/m³</span>
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#60a5fa', marginTop: '6px', cursor: 'pointer' }}>
                Click marker to set as location ↑
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
