import React, { useState } from "react";

function LocationDetector({ setCoordinates, setLocationName, onClose }) {
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
                
                console.log(`📌 Your exact coordinates: ${lat}, ${lon}`);
                
                try {
                    // Use Nominatim (OpenStreetMap) - better for precise location names
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
                        headers: {'Accept-Language': 'en'}
                    });
                    const data = await res.json();
                    
                    console.log("🌍 Full Nominatim Response:", data);
                    console.log("📊 ALL Address Components Available:", data.address);
                    
                    // Display all components with their exact values
                    if (data.address) {
                        console.group("🔍 Detailed Address Breakdown:");
                        Object.entries(data.address).forEach(([key, value]) => {
                            console.log(`  ${key}: "${value}"`);
                        });
                        console.groupEnd();
                    }
                    
                    // Use the 'name' field if available (most specific), then fallback to address components
                    // 'name' is typically the most precise location name from OSM data
                    let locationName_value = data.name;
                    let source = "name";
                    
                    // If no name, try address components in order of specificity
                    if (!locationName_value && data.address) {
                        const address = data.address;
                        const priority = [
                            'hamlet',           // Smallest unit - specific hamlet/locality
                            'village',
                            'town',
                            'suburb',
                            'village_block',
                            'municipality', 
                            'city',
                            'county',
                            'state'
                        ];
                        
                        for (let component of priority) {
                            if (address[component]) {
                                locationName_value = address[component];
                                source = component;
                                break;
                            }
                        }
                    }
                    
                    if (!locationName_value) {
                        locationName_value = 'Local Region';
                        source = 'fallback';
                    }
                    
                    const state = data.address?.state || '';
                    const country = data.address?.country || '';
                    
                    console.log(`✅ SELECTED: "${locationName_value}" (from: ${source})`);
                    console.log(`📍 Map Location: ${locationName_value}, ${state}, ${country}`);
                    console.log(`🎯 This should match the location shown on your map marker`);
                    
                    setLocationName({
                        city: locationName_value,
                        state: state,
                        country: country
                    });
                } catch (err) {
                    console.error("❌ Nominatim Error:", err);
                    // Fallback to BigDataCloud
                    try {
                        const fallbackRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                        const fallbackData = await fallbackRes.json();
                        console.log("📍 Fallback - BigDataCloud Response:", fallbackData);
                        
                        const locationName_value = fallbackData.village || fallbackData.town || fallbackData.locality || fallbackData.city || 'Local Region';
                        console.log(`✅ Using Fallback: "${locationName_value}"`);
                        
                        setLocationName({
                            city: locationName_value,
                            state: fallbackData.principalSubdivision || '',
                            country: fallbackData.countryName || ''
                        });
                    } catch (fallbackErr) {
                        console.error("❌ All APIs failed:", fallbackErr);
                        setLocationName({ city: "Unknown Area", state: "", country: ""});
                    }
                }

                setCoordinates({ lat, lon });
                setLoading(false);
                // Close the modal overlay after location is set
                if (onClose) onClose();
            },
            () => {
                setError("Location access denied. Please allow it in your browser.");
                setLoading(false);
            }
        );
    };

    return (
        <div className="location-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
            <div className="location-modal-card" style={{ position: 'relative' }}>
                {/* Close button — only shown when onClose is available (re-detect flow) */}
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '14px', right: '14px',
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '50%', width: '28px', height: '28px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '14px',
                            lineHeight: 1, padding: 0,
                        }}
                        title="Close"
                    >
                        ✕
                    </button>
                )}
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