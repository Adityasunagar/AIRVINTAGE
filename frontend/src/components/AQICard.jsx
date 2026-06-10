import React, { useEffect, useState } from "react";
import { AlertCircle, Lightbulb, Shield, Wind, Home, Baby, Activity, Heart, Briefcase, Check } from "lucide-react";

function getPollutantStatus(type, value) {
    if (value == null) return { status: "Unknown", color: "var(--text-3)", bg: "rgba(255,255,255,0.05)", pct: 0 };
    let limit = 1;
    let max = 100;
    
    switch (type) {
        case 'pm2_5':
            limit = 15;
            max = 75;
            break;
        case 'pm10':
            limit = 45;
            max = 150;
            break;
        case 'co':
            limit = 4000;
            max = 10000;
            break;
        case 'no2':
            limit = 25;
            max = 100;
            break;
        case 'o3':
            limit = 100;
            max = 200;
            break;
        case 'so2':
            limit = 40;
            max = 150;
            break;
        default:
            break;
    }
    
    const pct = Math.min((value / max) * 100, 100);
    const ratio = value / limit;
    
    let status = "Good";
    let color = "#4ade80";
    let bg = "rgba(74, 222, 128, 0.1)";
    
    if (ratio > 2.0) {
        status = "Hazardous";
        color = "#c084fc";
        bg = "rgba(192, 132, 252, 0.15)";
    } else if (ratio > 1.5) {
        status = "Unhealthy";
        color = "#f87171";
        bg = "rgba(248, 113, 113, 0.15)";
    } else if (ratio > 1.0) {
        status = "Poor";
        color = "#fb923c";
        bg = "rgba(251, 146, 60, 0.15)";
    } else if (ratio > 0.6) {
        status = "Moderate";
        color = "#facc15";
        bg = "rgba(250, 204, 21, 0.15)";
    }
    
    return { status, color, bg, pct };
}

function AQICard({ aqiData }) {
    const [animate, setAnimate] = useState(false);
    const [activeCohort, setActiveCohort] = useState("general");

    useEffect(() => {
        setAnimate(false);
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
    }, [aqiData]);

    if (!aqiData) return null;

    const pollutants = [
        {
            key: 'pm2_5',
            symbol: 'PM2.5',
            name: 'Fine Particles',
            value: aqiData.pm2_5,
            limitText: 'WHO Limit: 15 μg/m³',
        },
        {
            key: 'pm10',
            symbol: 'PM10',
            name: 'Coarse Particles',
            value: aqiData.pm10,
            limitText: 'WHO Limit: 45 μg/m³',
        },
        {
            key: 'co',
            symbol: 'CO',
            name: 'Carbon Monoxide',
            value: aqiData.carbon_monoxide,
            limitText: 'NAAQS Limit: 4000 µg/m³',
        },
        {
            key: 'no2',
            symbol: 'NO₂',
            name: 'Nitrogen Dioxide',
            value: aqiData.nitrogen_dioxide,
            limitText: 'WHO Limit: 25 μg/m³',
        },
        {
            key: 'o3',
            symbol: 'O₃',
            name: 'Ground Ozone',
            value: aqiData.ozone,
            limitText: 'WHO Limit: 100 μg/m³',
        },
        {
            key: 'so2',
            symbol: 'SO₂',
            name: 'Sulphur Dioxide',
            value: aqiData.sulphur_dioxide,
            limitText: 'WHO Limit: 40 μg/m³',
        }
    ];

    return (
        <div className="aqi-card-row">
            <div className="panel animate-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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

                <div className="details-grid" style={{ flex: 1, gridTemplateRows: 'repeat(2, 1fr)' }}>
                    {pollutants.map((p) => {
                        const statusInfo = getPollutantStatus(p.key, p.value);
                        return (
                            <div key={p.key} className="detail-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', height: 'auto', minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-2)', letterSpacing: '0.05em' }}>{p.symbol}</span>
                                    <span style={{
                                        fontSize: '9px',
                                        background: statusInfo.bg,
                                        color: statusInfo.color,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontWeight: 'bold',
                                        border: `1px solid ${statusInfo.color}30`
                                    }}>
                                        {statusInfo.status}
                                    </span>
                                </div>

                                <div style={{ position: 'relative', width: '85px', height: '85px', margin: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                        <path stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path stroke={statusInfo.color} strokeWidth="3" strokeDasharray={`${animate ? statusInfo.pct : 0}, 100`} strokeLinecap="round" fill="none" style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 4px ${statusInfo.color}60)` }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    </svg>
                                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-1)', fontFamily: 'Outfit, sans-serif' }}>{p.value != null ? p.value : '--'}</span>
                                        <span style={{ fontSize: '8px', color: 'var(--text-3)', fontWeight: '700', marginTop: '-2px' }}>μg/m³</span>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{p.limitText}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Smart Health & Activity Insights */}
            {aqiData.health_recommendations ? (
                <div className="panel animate-in health-recommendations-section" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#60a5fa' }}>
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                            <span className="panel-title">Smart Health Advisory</span>
                        </div>
                        {aqiData.health_recommendations.dominant_pollutant && aqiData.health_recommendations.dominant_pollutant !== "None" && (
                            <span style={{
                                fontSize: '11px',
                                background: 'rgba(96, 165, 250, 0.1)',
                                color: '#60a5fa',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(96, 165, 250, 0.2)',
                                fontWeight: 'bold'
                            }}>
                                Dominant: {aqiData.health_recommendations.dominant_pollutant}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                        
                        {/* Weather Warnings (if any) */}
                        {aqiData.health_recommendations.weather_warnings && aqiData.health_recommendations.weather_warnings.length > 0 && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '12px 16px',
                                borderRadius: '10px'
                            }}>
                                {aqiData.health_recommendations.weather_warnings.map((warn, i) => (
                                    <div key={i} style={{ fontSize: '13px', color: '#f87171', lineHeight: '1.4' }}>
                                        {warn}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* General Summary Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
                            border: '1px solid var(--nav-border)',
                            padding: '16px',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 'bold' }}>
                                <AlertCircle size={14} /> Current Status Summary
                            </div>
                            <div style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: '500', lineHeight: '1.5' }}>
                                {aqiData.health_recommendations.general_recommendations.message}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
                                {aqiData.health_recommendations.general_recommendations.mask_needed && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#fb923c', background: 'rgba(251, 146, 96, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(251, 146, 96, 0.2)' }}>
                                        <Shield size={13} /> {aqiData.health_recommendations.general_recommendations.mask_type}
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Wind size={13} /> {aqiData.health_recommendations.general_recommendations.ventilation}
                                </div>
                            </div>
                        </div>

                        {/* Cohort Tabs Selector */}
                        <div className="cohort-tabs-row no-scrollbar">
                            {[
                                { id: 'general', label: 'Everyone', icon: <Home size={14} />, color: 'var(--accent)' },
                                { id: 'children_elderly', label: 'Kids & Seniors', icon: <Baby size={14} />, color: '#facc15' },
                                { id: 'respiratory', label: 'Asthmatics', icon: <Activity size={14} />, color: '#60a5fa' },
                                { id: 'cardiovascular', label: 'Heart Cohort', icon: <Heart size={14} />, color: '#f87171' },
                                { id: 'outdoor_workers', label: 'Workers/Athletes', icon: <Briefcase size={14} />, color: '#34d399' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveCohort(tab.id)}
                                    className={`cohort-tab-btn${activeCohort === tab.id ? ' active' : ''}`}
                                    style={{
                                        whiteSpace: 'nowrap',
                                        background: activeCohort === tab.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        border: '1px solid',
                                        borderColor: activeCohort === tab.id ? tab.color : 'rgba(255, 255, 255, 0.05)',
                                        color: activeCohort === tab.id ? 'var(--text-1)' : 'var(--text-2)',
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        fontSize: '13px',
                                        fontWeight: activeCohort === tab.id ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        outline: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Cohort Detail Box */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                            border: '1px solid var(--nav-border)',
                            padding: '16px',
                            borderRadius: '12px',
                            minHeight: '80px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: '1.6' }}>
                                {aqiData.health_recommendations.cohort_recommendations[activeCohort]}
                            </div>
                        </div>

                        {/* Actionable Tips */}
                        {aqiData.health_recommendations.actionable_tips && aqiData.health_recommendations.actionable_tips.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Actionable Tips</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {aqiData.health_recommendations.actionable_tips.map((tip, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <Check size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: '3px' }} />
                                            <span style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: '1.4' }}>{tip}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            ) : aqiData.health_advisory ? (
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
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
                            border: '1px solid var(--nav-border)',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 'bold' }}>
                                <AlertCircle size={14} strokeWidth={2.5} /> Current Alert
                            </div>
                            <div style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: '500', lineHeight: '1.5' }}>
                                {aqiData.health_advisory.message || "Air quality is currently being monitored."}
                            </div>
                        </div>

                        <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'center', 
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
                            border: '1px solid var(--nav-border)',
                            padding: '16px 20px', 
                            borderRadius: '12px',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 'bold' }}>
                                <Lightbulb size={14} strokeWidth={2.5} /> Actionable Advice
                            </div>
                            <div style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: '500', lineHeight: '1.5' }}>
                                {aqiData.health_advisory.recommendation || "Maintain normal outdoor activities."}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default AQICard;
