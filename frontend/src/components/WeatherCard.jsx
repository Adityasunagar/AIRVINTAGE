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

function getUVDesc(uv) {
    if (uv == null) return "No data";
    if (uv <= 2) return { text: "Low", color: "#22c55e" };
    if (uv <= 5) return { text: "Moderate", color: "#eab308" };
    if (uv <= 7) return { text: "High", color: "#f97316" };
    if (uv <= 10) return { text: "Very High", color: "#ef4444" };
    return { text: "Extreme", color: "#a855f7" };
}

function formatTime(isoString) {
    if (!isoString) return "--:--";
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return "--:--";
    }
}

const WeatherCard = ({ weatherData }) => {
    if (!weatherData) return null;

    const { 
        temperature, feels_like, humidity, dewpoint, 
        wind_speed, wind_direction, wind_gusts, wind_deg,
        visibility, condition, pressure, cloudcover, 
        precip_prob, uv_index,
        sunrise, sunset, moon_phase
    } = weatherData;

    // Derived logic
    const visVal = visibility ?? 10; 
    const isVisGood = visVal >= 10;

    const humidityVal = humidity ?? 50;
    const uvInfo = getUVDesc(uv_index);

    return (
        <div className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1', width: '100%' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
                <span className="panel-title">Weather Details</span>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Right now</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', padding: '0 16px 16px' }}>
                
                {/* 1. Temperature */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Temperature</div>
                    <div style={{ height: '70px', position: 'relative', marginTop: '10px' }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <path d="M0 30 Q 50 20 100 10" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="80" cy="14" r="4" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-1)' }}>Current Temp</div>
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(temperature)}°</div>
                    </div>
                </div>

                {/* 2. Feels Like */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Feels like</div>
                    <div style={{ height: '50px', position: 'relative', marginTop: '20px' }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <path d="M10 20 Q 50 5 90 30" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="80" cy="24" r="5" fill="#e0f2fe" stroke="var(--accent)" strokeWidth="2" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{Math.round(feels_like)}°</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>Actual: {Math.round(temperature)}°</span>
                    </div>
                    <div style={{ fontSize: '13px', marginTop: 'auto', paddingTop: '12px', color: 'var(--text-2)' }}>
                        {feels_like > temperature ? 'Feels warmer due to humidity.' : (feels_like < temperature ? 'Feels colder due to wind.' : 'Feels just like the actual temperature.')}
                    </div>
                </div>

                {/* 3. Cloud cover */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Cloud cover</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent: 'center', border: '1px solid var(--card-border)', marginBottom: '8px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{cloudcover ?? 0}%</div>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600' }}>{condition}</div>
                    </div>
                </div>

                {/* 4. Precipitation Probability */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Precipitation</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                                <path stroke="rgba(255,255,255,0.1)" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path stroke="#38bdf8" strokeWidth="3" strokeDasharray={`${precip_prob ?? 0}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{precip_prob ?? 0}<span style={{fontSize:'12px'}}>%</span></span>
                            </div>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: 'auto', paddingTop: '12px', color: (precip_prob ?? 0) > 20 ? '#38bdf8' : 'var(--text-2)' }}>
                            {(precip_prob ?? 0) > 20 ? 'Rain expected' : 'Dry conditions'}
                        </div>
                    </div>
                </div>

                {/* 5. Wind Compass */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Wind</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ position: 'absolute', top: '5px', left: '0', right: '0', textAlign: 'center', fontSize: '10px', color: 'var(--text-3)' }}>N</div>
                            <div style={{ position: 'absolute', bottom: '5px', left: '0', right: '0', textAlign: 'center', fontSize: '10px', color: 'var(--text-3)' }}>S</div>
                            <div style={{ position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-3)' }}>W</div>
                            <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-3)' }}>E</div>
                            <div style={{ position: 'absolute', inset: 0, display:'flex', alignItems:'center', justifyContent:'center', transform: `rotate(${wind_deg ?? 0}deg)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                <svg width="24" height="40" viewBox="0 0 24 40" style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.5))', marginBottom: '10px' }}>
                                    <path d="M12 0 L22 30 L12 24 Z" fill="#22c55e" />
                                    <path d="M12 0 L2 30 L12 24 Z" fill="#16a34a" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px' }}>From {wind_direction} ({wind_deg}°)</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{Math.round(wind_speed)} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-2)' }}>km/h Speed</span></div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{Math.round(wind_gusts ?? wind_speed)} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-2)' }}>km/h Gust</span></div>
                        </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent)', marginTop: 'auto' }}>{getWindDesc(wind_speed)}</div>
                </div>

                {/* 6. Humidity */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Humidity</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, marginTop: '20px' }}>
                        <div style={{ display: 'flex', gap: '4px', height: '60px', alignItems: 'flex-end' }}>
                            {[20,40,60,80,100,100].map((h, i) => (
                                <div key={i} style={{ width: '6px', height: `${h}%`, background: humidityVal > i*20 ? '#60a5fa' : 'rgba(255,255,255,0.1)', borderRadius: '3px', transition: 'background 0.5s' }} />
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{humidityVal}<span style={{fontSize:'14px', color:'var(--text-3)'}}>%</span></div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{Math.round(dewpoint ?? temperature)}° <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-2)' }}>Dew Point</span></div>
                        </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: 'auto', color: 'var(--accent)' }}>{getHumidityDesc(humidityVal)}</div>
                </div>

                {/* 7. UV Index */}
                <div className="weather-detail-widget">
                    <div className="wd-label">UV Index</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: '20px' }}>
                        <div style={{ position: 'relative', width: '120px', height: '60px', overflow: 'visible' }}>
                            <svg viewBox="0 0 100 50" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <defs>
                                    <linearGradient id="uvGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#22c55e" />
                                        <stop offset="30%" stopColor="#eab308" />
                                        <stop offset="70%" stopColor="#ef4444" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                                <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="url(#uvGradient)" strokeWidth="8" strokeLinecap="round" />
                                {(() => {
                                    const ratio = Math.min(uv_index ?? 0, 12) / 12;
                                    const angle = Math.PI - (ratio * Math.PI);
                                    const cx = 50 + 40 * Math.cos(angle);
                                    const cy = 45 - 40 * Math.sin(angle);
                                    return <circle cx={cx} cy={cy} r="6" fill="#ffffff" stroke={uvInfo.color} strokeWidth="2" />;
                                })()}
                            </svg>
                            <div style={{ position: 'absolute', bottom: '-8px', left: 0, right: 0, textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                                {uv_index ?? 0}
                            </div>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: 'auto', paddingTop: '20px', color: uvInfo.color }}>{uvInfo.text}</div>
                    </div>
                </div>

                {/* 8. Visibility */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Visibility</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', width: '100%', padding: '0 20px' }}>
                            {[80, 60, 40, 20].map((w, i) => (
                                <div key={i} style={{ width: `${w}%`, height: '6px', background: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444'), borderRadius: '3px', opacity: 1 - (i*0.2) }} />
                            ))}
                            <div style={{ width: '100%', height: '8px', background: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444'), borderRadius: '4px', marginTop: '4px' }}></div>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '16px' }}>{Math.round(visVal)} <span style={{fontSize:'14px'}}>km</span></div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: 'auto', color: isVisGood ? '#22c55e' : (visVal > 4 ? '#eab308' : '#ef4444') }}>{getVisibilityDesc(visVal)}</div>
                </div>

                {/* 9. Pressure */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Pressure</div>
                    <div style={{ height: '60px', position: 'relative', marginTop: '10px' }}>
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                            <path d="M0 20 Q 50 15 100 25" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="80" cy="23" r="5" fill="#e0f2fe" stroke="#8b5cf6" strokeWidth="2" />
                        </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(pressure ?? 1013)} <span style={{fontSize:'14px', color:'var(--text-3)', fontWeight:'normal'}}>mb</span></div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '8px' }}>{getPressureDesc(pressure)}</div>
                </div>

                {/* 10. Sun & Moon */}
                <div className="weather-detail-widget">
                    <div className="wd-label">Sun & Moon</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: '20px' }}>
                        <div style={{ position: 'relative', width: '120px', height: '60px', overflow: 'visible' }}>
                            <svg viewBox="0 0 100 50" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" />
                                {(() => {
                                    const now = new Date();
                                    const sr = new Date(sunrise);
                                    const ss = new Date(sunset);
                                    let sunRatio = 0;
                                    if (now > ss) sunRatio = 1;
                                    else if (now < sr) sunRatio = 0;
                                    else sunRatio = (now - sr) / (ss - sr);
                                    
                                    const sunAngle = Math.PI - (sunRatio * Math.PI);
                                    const sunX = 50 + 40 * Math.cos(sunAngle);
                                    const sunY = 45 - 40 * Math.sin(sunAngle);
                                    return <circle cx={sunX} cy={sunY} r="6" fill="#facc15" />;
                                })()}
                            </svg>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 10px', marginTop: '16px' }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatTime(sunrise)}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Sunrise</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{formatTime(sunset)}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Sunset</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: 'auto', paddingTop: '16px', color: 'var(--accent)' }}>Phase: {moon_phase || 'Waning Crescent'}</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WeatherCard;