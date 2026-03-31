import React, { useState } from "react";

function LocationDetector({ setCoordinates, setLocationName }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const detect = () => {
        if (!navigator.geolocation) {
            setError("Geolocation not supported by this browser.");
            return;
        }
        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude.toFixed(5);
                const lon = pos.coords.longitude.toFixed(5);
                
                try {
                    // Reverse geocode to get human readable city
                    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                    const data = await res.json();
                    
                    const city = data.city || data.locality;
                    const state = data.principalSubdivision;
                    const country = data.countryName || data.countryCode;
                    
                    setLocationName({
                        city: city || 'Local Region',
                        state: state || '',
                        country: country || ''
                    });
                } catch (err) {
                    setLocationName({ city: "Unknown Area", state: "", country: ""});
                }

                setCoordinates({ lat, lon });
                setLoading(false);
            },
            () => {
                setError("Location access denied. Please allow it in your browser.");
                setLoading(false);
            }
        );
    };

    return (
        <div className="location-modal-overlay">
            <div className="location-modal-card">
                <div className="modal-icon-wrap">
                    <span className="modal-icon">🍃</span>
                </div>
                <h2 className="modal-title">Live Air Quality Insights</h2>
                <p className="modal-subtitle">
                    AirVintage focuses heavily on your hyper-local Air Quality Index (AQI). 
                    Allow location access to instantly detect harmful pollutants in your precise area.
                </p>

                <button className="locate-btn modal-btn" onClick={detect} disabled={loading}>
                    {loading ? (
                        <>
                            <div className="spinner modal-spinner" />
                            Analyzing Coordinates…
                        </>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="10" r="3"/>
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                            </svg>
                            Detect My Location
                        </>
                    )}
                </button>

                {error && (
                    <div className="modal-error">
                        ⚠️ {error}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LocationDetector;