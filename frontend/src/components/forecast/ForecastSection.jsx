import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CloudSun } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import TrendChart from './TrendChart';

const FORECAST_CACHE = {};
// Cache version - increment to force cache bust after backend changes
const CACHE_VERSION = 2;

const ForecastSection = ({ lat, lon }) => {
  const location = useLocation();
  // daily[0] = Today (the backend weather API starts from today, no past_days)
  const initialDayIdx = location.state?.selectedDayIdx ?? 0;

  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDayIdx, setSelectedDayIdx] = useState(initialDayIdx);
  const [feelsLike, setFeelsLike] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync if navigation state changes (e.g. clicking a different day from the dashboard)
  useEffect(() => {
    if (location.state?.selectedDayIdx !== undefined) {
      setSelectedDayIdx(location.state.selectedDayIdx);
    }
  }, [location.state]);

  useEffect(() => {
    if (!lat || !lon) return;

    const cacheKey = `${lat},${lon},v${CACHE_VERSION}`;
    // Clear any old cache keys (different version)
    Object.keys(FORECAST_CACHE).forEach(k => {
      if (!k.endsWith(`v${CACHE_VERSION}`)) delete FORECAST_CACHE[k];
    });

    if (FORECAST_CACHE[cacheKey]) {
      setData(FORECAST_CACHE[cacheKey]);
      setLoading(false);
      return;
    }

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;
        const response = await fetch(`${baseUrl}/forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon })
        });

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const result = await response.json();
        if (!result || !result.hourly) throw new Error("Invalid data format");
        
        FORECAST_CACHE[`${lat},${lon},v${CACHE_VERSION}`] = result;
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [lat, lon]);

  // --- Loading state ---
  if (loading) {
    return (
      <div className="panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ height: '24px', width: '120px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', animation: 'shimmer 1.5s infinite' }} />
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: '32px', width: '80px', borderRadius: '100px', background: 'rgba(255,255,255,0.06)', animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{ flex: i === 1 ? '2 0 160px' : '1 0 90px', height: '110px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', animation: 'shimmer 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ height: '180px', borderRadius: '24px', background: 'rgba(255,255,255,0.04)', animation: 'shimmer 1.5s infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>Fetching 7-day forecast…</span>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><CloudSun size={48} style={{ color: 'var(--text-3)' }} /></div>
        <h3 style={{ color: 'var(--text-1)', margin: '0 0 8px' }}>Forecast Unavailable</h3>
        <p style={{ color: 'var(--text-3)', fontSize: '14px', margin: '0 0 20px' }}>{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            const base = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;
            fetch(`${base}/forecast`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon }) })
              .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
              .then(result => { if (!result?.hourly) throw new Error("Invalid data"); setData(result); setLoading(false); })
              .catch(err => { setError(err.message || err); setLoading(false); });
          }}
          style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', padding: '10px 24px', borderRadius: '100px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // --- No data fallback ---
  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', key: feelsLike ? 'apparent_temp' : 'temp', unit: '°C' },
    { id: 'precip', label: 'Precipitation', key: 'precip_prob', unit: '%' },
    { id: 'wind', label: 'Wind', key: 'wind', unit: 'km/h' },
    { id: 'aqi', label: 'Air Quality', key: 'aqi', unit: '' },
    { id: 'humidity', label: 'Humidity', key: 'humidity', unit: '%' },
    { id: 'cloud', label: 'Cloud cover', key: 'cloud', unit: '%' },
  ];

  const currentTab = tabs.find(t => t.id === activeTab);

  // Filter 24h data for selected day
  const targetDateStr = data.daily[selectedDayIdx].date.split('T')[0];
  const chartData = data.hourly.filter(h => h.time.startsWith(targetDateStr));

  return (
    <div className="panel" style={{ 
      padding: '24px', 
      position: 'relative', 
      width: '100%',
      transform: 'none',
    }}>
      
      {/* Top Header & Tabs (as seen in screenshot) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', overflowX: 'auto', scrollbarWidth: 'none', width: '100%', WebkitOverflowScrolling: 'touch' }}>
        <h2 style={{ color: 'var(--text-1)', fontSize: '20px', fontWeight: 'bold', margin: '0', flexShrink: 0 }}>Hourly</h2>
        
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '100px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? '700' : '500',
              background: activeTab === tab.id ? 'var(--accent)' : 'rgba(128, 128, 128, 0.1)',
              color: activeTab === tab.id ? 'var(--bg)' : 'var(--text-1)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Day Grid — flex, fills full width, no scrolling */}
      <div className="forecast-day-grid" style={{ 
        display: 'flex',
        gap: '10px',
        width: '100%'
      }}>
        {data.daily.map((day, idx) => {
          const isActive = idx === selectedDayIdx;
          const dateObj = new Date(day.date);
          const dayNum = dateObj.getDate();
          const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

          let dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          if (idx === 0) dayLabel = 'Today';
          if (idx === 1) dayLabel = 'Tomorrow';

          return (
            <div
              key={day.date}
              className={`forecast-section-day-card ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedDayIdx(idx)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '16px 10px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(99,102,241,0.12))'
                  : 'rgba(128, 128, 128, 0.06)',
                border: `1px solid ${isActive ? 'rgba(56,189,248,0.4)' : 'rgba(128,128,128,0.1)'}`,
                boxShadow: isActive ? '0 4px 20px rgba(56,189,248,0.15)' : 'none',
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: '600',
                color: isActive ? 'var(--accent)' : 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>{dayLabel}</span>

              <span style={{
                fontSize: '22px', fontWeight: 'bold',
                color: isActive ? 'var(--text-1)' : 'var(--text-2)', lineHeight: 1
              }}>{dayNum}</span>

              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{month}</span>

              <div style={{
                background: isActive ? 'rgba(56,189,248,0.12)' : 'rgba(128,128,128,0.08)',
                borderRadius: '50%', padding: '7px',
                border: isActive ? '1px solid rgba(56,189,248,0.25)' : '1px solid transparent'
              }}>
                <WeatherIcon code={day.weather_code} size={24} />
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(day.temp_max)}°</span>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{Math.round(day.temp_min)}°</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Section Header */}
      <div style={{ background: 'rgba(128, 128, 128, 0.08)', borderRadius: '24px', padding: '24px', marginTop: '8px', border: '1px solid var(--panel-sep)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--text-1)', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            {currentTab.label}
          </h3>
          
          {activeTab === 'overview' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <div style={{
              width: '36px', height: '20px', background: feelsLike ? '#3b82f6' : 'var(--panel-sep)', 
              borderRadius: '20px', position: 'relative', transition: 'all 0.3s'
            }}>
              <div style={{
                width: '16px', height: '16px', background: 'white', borderRadius: '50%',
                position: 'absolute', top: '2px', left: feelsLike ? '18px' : '2px', transition: 'all 0.3s'
              }}/>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '500' }}>Feels like</span>
            <input type="checkbox" checked={feelsLike} onChange={() => setFeelsLike(!feelsLike)} style={{ display: 'none' }} />
          </label>
          )}
        </div>

        <TrendChart 
          key={`${activeTab}-${selectedDayIdx}-${feelsLike}`}
          data={chartData} 
          dataKey={currentTab.key}
          color={currentTab.id === 'overview' ? 'var(--accent)' : '#3b82f6'}
          unit={currentTab.unit}
          gradientId={`grad-${currentTab.id}`}
        />

        {/* Chart Footer: Moon phase */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{currentTab.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MoonIcon />
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Moon phase: <strong style={{color: 'var(--text-1)'}}>{data.daily[selectedDayIdx].moon_phase}</strong></span>
          </div>
        </div>
      </div>

    </div>
  );
};

const MoonIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: "var(--accent)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

export default ForecastSection;
