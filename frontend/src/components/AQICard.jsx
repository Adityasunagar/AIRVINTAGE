import React, { useEffect, useState } from "react";

function AQICard({ aqiData }) {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        setAnimate(false);
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
    }, [aqiData]);

    if (!aqiData) return null;

    return (
        <>
            <div className="panel animate-in">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="panel-title">Air Quality Pollutants</span>
                {aqiData.aqi && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-2)' }}>AQI</span>
                        <div style={{
                            background: aqiData.aqi <= 50 ? 'rgba(74, 222, 128, 0.2)' : 
                                        aqiData.aqi <= 100 ? 'rgba(250, 204, 21, 0.2)' : 
                                        aqiData.aqi <= 150 ? 'rgba(251, 146, 60, 0.2)' : 
                                        aqiData.aqi <= 200 ? 'rgba(248, 113, 113, 0.2)' : 'rgba(192, 132, 252, 0.2)',
                            color: aqiData.aqi <= 50 ? '#4ade80' : 
                                   aqiData.aqi <= 100 ? '#facc15' : 
                                   aqiData.aqi <= 150 ? '#fb923c' : 
                                   aqiData.aqi <= 200 ? '#f87171' : '#c084fc',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '18px'
                        }}>
                            {aqiData.aqi}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="details-grid">
                {/* PM2.5 */}
                <div className="detail-card" data-tooltip="WHO safe: 15 μg/m³ (24h avg)">
                    <div className="detail-card-label">PM2.5</div>
                    <div className="detail-card-value">
                        {aqiData.pm2_5}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar pm-bar" style={{ width: animate ? `${Math.min((aqiData.pm2_5 / 50) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Fine particles · WHO limit 15</div>
                </div>

                {/* PM10 */}
                <div className="detail-card" data-tooltip="WHO safe: 45 μg/m³ (24h avg)">
                    <div className="detail-card-label">PM10</div>
                    <div className="detail-card-value">
                        {aqiData.pm10}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar pm-bar" style={{ width: animate ? `${Math.min((aqiData.pm10 / 100) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Coarse particles · WHO limit 45</div>
                </div>

                {/* Carbon Monoxide */}
                <div className="detail-card" data-tooltip="NAAQS safe: 4 mg/m³ (8h avg)">
                    <div className="detail-card-label">CO</div>
                    <div className="detail-card-value">
                        {aqiData.carbon_monoxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar co-bar" style={{ width: animate ? `${Math.min((aqiData.carbon_monoxide / 1000) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Carbon Monoxide · NAAQS 4mg</div>
                </div>

                {/* Nitrogen Dioxide */}
                <div className="detail-card" data-tooltip="WHO safe: 25 μg/m³ (24h avg)">
                    <div className="detail-card-label">NO₂</div>
                    <div className="detail-card-value">
                        {aqiData.nitrogen_dioxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar no2-bar" style={{ width: animate ? `${Math.min((aqiData.nitrogen_dioxide / 100) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Nitrogen Dioxide · WHO limit 25</div>
                </div>

                {/* Ozone */}
                <div className="detail-card" data-tooltip="WHO safe: 100 μg/m³ (8h avg)">
                    <div className="detail-card-label">O₃</div>
                    <div className="detail-card-value">
                        {aqiData.ozone}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar o3-bar" style={{ width: animate ? `${Math.min((aqiData.ozone / 150) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Ground-level Ozone · WHO limit 100</div>
                </div>

                {/* Sulphur Dioxide */}
                <div className="detail-card" data-tooltip="WHO safe: 40 μg/m³ (24h avg)">
                    <div className="detail-card-label">SO₂</div>
                    <div className="detail-card-value">
                        {aqiData.sulphur_dioxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar so2-bar" style={{ width: animate ? `${Math.min((aqiData.sulphur_dioxide / 50) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Sulphur Dioxide · WHO limit 40</div>
                </div>

            </div>
        </div>

        {/* Smart Health & Activity Insights */}
            {aqiData.health_advisory && (
                <div className="panel animate-in health-advisory-section" style={{ 
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#60a5fa' }}>
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        <span className="panel-title">Smart Health Insights</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '16px', padding: '16px' }}>
                        <div style={{ 
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.15)', 
                            padding: '16px 20px', 
                            borderRadius: '12px', 
                            borderLeft: `4px solid ${
                                aqiData.aqi <= 50 ? '#4ade80' : 
                                aqiData.aqi <= 100 ? '#facc15' : 
                                aqiData.aqi <= 150 ? '#fb923c' : 
                                aqiData.aqi <= 200 ? '#f87171' : '#c084fc'
                            }` 
                        }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>Current Alert</div>
                            <div style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: '500', lineHeight: '1.5' }}>
                                {aqiData.health_advisory.message || "Air quality is currently being monitored."}
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>Actionable Advice</div>
                            <div style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: '500', lineHeight: '1.5' }}>
                                {aqiData.health_advisory.recommendation || "Maintain normal outdoor activities."}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AQICard;
