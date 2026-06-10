import React, { useState } from "react";
import { X, Wind, AlertTriangle } from "lucide-react";

function LocationDetector({ setCoordinates, setLocationName, onClose }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);

    // Resolves official city center coordinates for exact alignment
    const getCityCenterCoords = async (city, state, country) => {
        try {
            const query = [city, state, country].filter(Boolean).join(", ");
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                }
            }
        } catch (err) {
            console.warn("City center fetch failed:", err);
        }
        return null;
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setError(null);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (!res.ok) throw new Error("Search failed");
            const data = await res.json();
            if (!data || data.length === 0) {
                setError("Location not found. Try searching with city, country.");
                setSearching(false);
                return;
            }
            const match = data[0];
            let lat = parseFloat(match.lat);
            let lon = parseFloat(match.lon);

            // Extract components
            let cityVal = match.name || match.display_name.split(',')[0];
            const state = match.address?.state || '';
            const country = match.address?.country || '';

            // Snap search to official city center if possible
            const center = await getCityCenterCoords(cityVal, state, country);
            if (center) {
                lat = center.lat;
                lon = center.lon;
            }

            setLocationName({
                city: cityVal,
                state: state,
                country: country
            });
            setCoordinates({ lat, lon, accuracy: null });
            setSearching(false);
            if (onClose) onClose();
        } catch (err) {
            console.error("Search error:", err);
            setError("Unable to search location. Try again later.");
            setSearching(false);
        }
    };

    // Fallback IP Geolocation method if browser permission is denied or times out
    const fetchIPLocation = async () => {
        try {
            const res = await fetch("https://ipapi.co/json/");
            if (!res.ok) throw new Error("IP geolocation failed");
            const data = await res.json();

            let lat = parseFloat(data.latitude);
            let lon = parseFloat(data.longitude);
            const cityVal = data.city || 'Local Region';
            const state = data.region || '';
            const country = data.country_name || '';

            // Snap to city center
            const center = await getCityCenterCoords(cityVal, state, country);
            if (center) {
                lat = center.lat;
                lon = center.lon;
            }

            setLocationName({
                city: cityVal,
                state: state,
                country: country
            });
            setCoordinates({ lat, lon, accuracy: null });
            setLoading(false);
            if (onClose) onClose();
        } catch (err) {
            console.error("IP Geolocation failed:", err);
            setError("Could not auto-detect location. Please search manually above.");
            setLoading(false);
        }
    };

    const detect = () => {
        if (!navigator.geolocation) {
            fetchIPLocation();
            return;
        }
        setLoading(true);
        setError(null);

        // Use watchPosition instead of getCurrentPosition so the browser
        // keeps refining the fix. We accept the reading as soon as accuracy
        // reaches ≤100 m, or after 12 s we take whatever we have.
        let watchId = null;
        let settled  = false;

        const applyPosition = async (pos) => {
            if (settled) return;
            settled = true;

            if (watchId !== null) navigator.geolocation.clearWatch(watchId);

            // ── Use raw GPS coordinates — do NOT snap to city center ──
            // City-center snapping was the main cause of inaccuracy:
            // it replaced your precise GPS fix with a generic city centroid.
            const lat      = parseFloat(pos.coords.latitude.toFixed(7));
            const lon      = parseFloat(pos.coords.longitude.toFixed(7));
            const accuracy = pos.coords.accuracy;

            let cityVal = "";
            let state   = "";
            let country = "";

            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                if (res.ok) {
                    const data = await res.json();
                    cityVal = data.name || "";
                    if (!cityVal && data.address) {
                        for (const key of ['suburb', 'city', 'town', 'village', 'municipality', 'hamlet', 'county', 'state']) {
                            if (data.address[key]) { cityVal = data.address[key]; break; }
                        }
                    }
                    state   = data.address?.state   || "";
                    country = data.address?.country || "";
                }
            } catch (err) {
                console.warn("Nominatim reverse-geocode failed:", err);
            }

            // Fallback reverse geocoder
            if (!cityVal) {
                try {
                    const fb   = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                    const fbData = await fb.json();
                    cityVal = fbData.city || fbData.locality || fbData.village || fbData.town || "My Location";
                    state   = fbData.principalSubdivision || "";
                    country = fbData.countryName || "";
                } catch { cityVal = "My Location"; }
            }

            setLocationName({ city: cityVal, state, country });
            setCoordinates({ lat, lon, accuracy });
            setLoading(false);
            if (onClose) onClose();
        };

        const onError = (err) => {
            if (settled) return;
            settled = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            console.warn("GPS failed, falling back to IP Geolocation:", err);
            fetchIPLocation();
        };

        const geoOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

        // Hard fallback: if accuracy never reaches ≤100 m within 12 s, use what we have
        const hardTimeout = setTimeout(() => {
            if (!settled && watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                // Trigger one last getCurrentPosition to get whatever is available
                navigator.geolocation.getCurrentPosition(applyPosition, onError, geoOptions);
            }
        }, 12000);

        watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const acc = pos.coords.accuracy;
                // Accept as soon as we get a fix accurate to ≤100 m
                if (acc <= 100) {
                    clearTimeout(hardTimeout);
                    applyPosition(pos);
                }
                // Otherwise keep watching — the browser will keep refining
            },
            (err) => {
                clearTimeout(hardTimeout);
                onError(err);
            },
            geoOptions
        );
    };

    return (
        <div className="location-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
            <div className="location-modal-card" style={{ position: 'relative' }}>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '14px', right: '14px',
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '50%', width: '28px', height: '28px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0,
                            zIndex: 10
                        }}
                        title="Close"
                    >
                        <X size={15} />
                    </button>
                )}
                <div className="modal-icon-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
                    <Wind size={40} style={{ color: 'var(--accent)', filter: 'drop-shadow(0 0 8px var(--accent))' }} />
                </div>
                <h2 className="modal-title">Live Air Quality Insights</h2>
                <p className="modal-subtitle">
                    AirVintage focuses heavily on your hyper-local Air Quality Index (AQI).
                    Allow location access or search your city manually.
                </p>

                {/* Manual Search Input */}
                <div className="search-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '24px 0 16px', position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Search city (e.g. Bangalore, Delhi)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        disabled={loading || searching}
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'all 0.2s',
                        }}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading || searching || !searchQuery.trim()}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            background: 'var(--accent)',
                            border: 'none',
                            color: '#000',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {searching ? "Searching" : "Search"}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ margin: '0 12px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                <button className="locate-btn modal-btn" onClick={detect} disabled={loading || searching}>
                    {loading ? (
                        <>
                            <div className="spinner modal-spinner" />
                            Analyzing Coordinates…
                        </>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="10" r="3" />
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                            </svg>
                            Detect My Location
                        </>
                    )}
                </button>

                {error && (
                    <div className="modal-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LocationDetector;