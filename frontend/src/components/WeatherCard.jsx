import React from "react";

function getVisibilityDesc(v) {
    if (v == null) return "No data";
    if (v >= 20) return "Excellent clear view";
    if (v >= 10) return "Good visibility";
    if (v >= 5) return "Moderate haze";
    return "Poor visibility";
}

function getHumidityDesc(h) {
    if (h == null) return "No data";
    if (h < 30) return "Dry — low moisture";
    if (h < 60) return "Comfortable";
    if (h < 80) return "Humid";
    return "Very Humid — sticky";
}

function getPressureDesc(p) {
    if (p == null) return "No data";
    if (p < 1000) return "Low pressure system";
    if (p > 1020) return "High pressure system";
    return "Normal pressure";
}

function getWindDesc(w) {
    if (w == null) return "No data";
    if (w < 5) return "Calm breeze";
    if (w < 12) return "Light wind";
    if (w < 25) return "Moderate wind";
    if (w < 40) return "Strong wind";
    return "Storm-force winds";
}

const WeatherCard = ({ weatherData }) => {
    if (!weatherData) return null;

    const { temperature, min_temp, max_temp, humidity, wind_speed, wind_direction, visibility, condition, pressure, cloudcover, rain } = weatherData;

    // Derived logic
    const visVal = visibility ?? 10; 
    const isVisGood = visVal >= 10;
    
    const windDegMap = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
    const windDeg = windDegMap[wind_direction] ?? 0;

    const humidityVal = humidity ?? 50;

    return (
        <div style={{ paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-1)' }}>
                    Weather details <span style={{ fontSize: '14px', color: 'var(--text-3)', fontWeight: 'normal', marginLeft: '6px' }}>Right now</span>
                </h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                
                {/* 1. Temperature Curve */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Temperature</div>
                    <div style={{ height: '70px', position: 'relative', marginTop: '10px' }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <path d="M0 30 Q 50 20 100 10" fill="none" stroke="rgba(255,100,100,0.8)" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="80" cy="14" r="4" fill="#0f172a" stroke="#ef4444" strokeWidth="2" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-1)' }}>Temp</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{min_temp != null ? `${min_temp}° - ${max_temp}°` : 'Current'}</div>
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(temperature)}°</div>
                    </div>
                </div>

                {/* 2. Feels Like / Cloud cover */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Cloud cover</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent: 'center', border: '1px solid var(--card-border)', marginBottom: '8px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{cloudcover ?? 10}%</div>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600' }}>{condition}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Current dominant condition</div>
                    </div>
                </div>

                {/* 3. Precipitation */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Precipitation</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                                <path stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path stroke="#38bdf8" strokeWidth="3" strokeDasharray={`${rain ? 60 : 0}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{rain ?? 0}<span style={{fontSize:'12px'}}>mm</span></span>
                            </div>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px' }}>{rain ? 'Rain expected' : 'No Precipitation'}</div>
                    </div>
                </div>

                {/* 4. Wind Compass */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Wind</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                        <div style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ position: 'absolute', top: '5px', left: '0', right: '0', textAlign: 'center', fontSize: '10px', color: 'var(--text-3)' }}>N</div>
                            <div style={{ position: 'absolute', bottom: '5px', left: '0', right: '0', textAlign: 'center', fontSize: '10px', color: 'var(--text-3)' }}>S</div>
                            <div style={{ position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-3)' }}>W</div>
                            <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-3)' }}>E</div>
                            <div style={{ position: 'absolute', inset: 0, display:'flex', alignItems:'center', justifyContent:'center', transform: `rotate(${windDeg}deg)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="#38bdf8"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '4px' }}>From {wind_direction}</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{wind_speed} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-2)' }}>km/h</span></div>
                            <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Wind Speed</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: 'auto' }}>{getWindDesc(wind_speed)}</div>
                </div>

                {/* 5. Humidity */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Humidity</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, marginTop: '20px' }}>
                        <div style={{ display: 'flex', gap: '4px', height: '60px', alignItems: 'flex-end' }}>
                            {[20,40,60,80,100,100].map((h, i) => (
                                <div key={i} style={{ width: '6px', height: `${h}%`, background: humidityVal > i*20 ? '#60a5fa' : 'rgba(255,255,255,0.1)', borderRadius: '3px', transition: 'background 0.5s' }} />
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{humidityVal}<span style={{fontSize:'16px', color:'var(--text-3)'}}>%</span></div>
                            <div style={{ fontSize: '14px', color: 'var(--text-3)' }}>Relative Humidity</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: 'auto', color: 'var(--accent)' }}>{getHumidityDesc(humidityVal)}</div>
                </div>

                {/* 6. Visibility */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Visibility</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', width: '100%', padding: '0 20px' }}>
                            {[80, 60, 40, 20].map((w, i) => (
                                <div key={i} style={{ width: `${w}%`, height: '8px', background: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444'), borderRadius: '4px', opacity: 1 - (i*0.2) }} />
                            ))}
                            <div style={{ width: '100%', height: '12px', background: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444'), borderRadius: '6px', marginTop: '4px' }}></div>
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '16px' }}>{Math.round(visVal)} <span style={{fontSize:'16px'}}>km</span></div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: 'auto', color: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444') }}>{getVisibilityDesc(visVal)}</div>
                </div>

                {/* 7. Pressure */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Pressure</div>
                    <div style={{ height: '70px', position: 'relative', marginTop: '10px' }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <path d="M0 20 Q 50 15 100 25" fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="80" cy="23" r="5" fill="#e0f2fe" stroke="#60a5fa" strokeWidth="2" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(pressure ?? 1013)} <span style={{fontSize:'14px', color:'var(--text-3)', fontWeight:'normal'}}>mb (Now)</span></div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>{getPressureDesc(pressure)}</div>
                </div>

            </div>
        </div>
    );
};

export default WeatherCard;