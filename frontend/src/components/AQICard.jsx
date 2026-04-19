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
            <div className="panel-header">
                <span className="panel-title">Air Quality Pollutants</span>
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
