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
                <div className="detail-card">
                    <div className="detail-card-label">PM2.5</div>
                    <div className="detail-card-value">
                        {aqiData.pm2_5}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar pm-bar" style={{ width: animate ? `${Math.min((aqiData.pm2_5 / 50) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Fine particles matter</div>
                </div>

                {/* PM10 */}
                <div className="detail-card">
                    <div className="detail-card-label">PM10</div>
                    <div className="detail-card-value">
                        {aqiData.pm10}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar pm-bar" style={{ width: animate ? `${Math.min((aqiData.pm10 / 100) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Coarse particles matter</div>
                </div>

                {/* Carbon Monoxide */}
                <div className="detail-card">
                    <div className="detail-card-label">CO</div>
                    <div className="detail-card-value">
                        {aqiData.carbon_monoxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar co-bar" style={{ width: animate ? `${Math.min((aqiData.carbon_monoxide / 1000) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Carbon Monoxide</div>
                </div>

                {/* Nitrogen Dioxide */}
                <div className="detail-card">
                    <div className="detail-card-label">NO₂</div>
                    <div className="detail-card-value">
                        {aqiData.nitrogen_dioxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar no2-bar" style={{ width: animate ? `${Math.min((aqiData.nitrogen_dioxide / 100) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Nitrogen Dioxide</div>
                </div>

                {/* Ozone */}
                <div className="detail-card">
                    <div className="detail-card-label">O₃</div>
                    <div className="detail-card-value">
                        {aqiData.ozone}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar o3-bar" style={{ width: animate ? `${Math.min((aqiData.ozone / 150) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Ground-level Ozone</div>
                </div>

                {/* Sulphur Dioxide */}
                <div className="detail-card">
                    <div className="detail-card-label">SO₂</div>
                    <div className="detail-card-value">
                        {aqiData.sulphur_dioxide}<span className="detail-card-unit"> μg/m³</span>
                    </div>
                    <div className="detail-card-bar-wrap">
                        <div className="detail-card-bar so2-bar" style={{ width: animate ? `${Math.min((aqiData.sulphur_dioxide / 50) * 100, 100)}%` : '0%' }} />
                    </div>
                    <div className="detail-card-desc">Sulphur Dioxide</div>
                </div>

            </div>
        </div>
    );
}

export default AQICard;
