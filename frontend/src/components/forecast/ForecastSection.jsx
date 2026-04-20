import React, { useState, useEffect } from 'react';
// Removed unused lucide-react imports
import WeatherIcon from './WeatherIcon';
import TrendChart from './TrendChart';

const ForecastSection = ({ lat, lon }) => {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDayIdx, setSelectedDayIdx] = useState(1);
  const [feelsLike, setFeelsLike] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;

    const fetchForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon })
        });

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const result = await response.json();
        if (!result || !result.hourly) throw new Error("Invalid data format");
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [lat, lon]);

  if (loading || error || !data) return null;

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
              color: activeTab === tab.id ? '#0f172a' : 'var(--text-1)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Carousel Grid */}
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none', width: '100%' }}>
        {data.daily.map((day, idx) => {
          const isActive = idx === selectedDayIdx;
          const dateObj = new Date(day.date);
          const dayNum = dateObj.getDate();
          
          let dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          if (idx === 0) dayLabel = 'Yesterday';
          if (idx === 1) dayLabel = 'Today';

          return (
            <div 
              key={day.date}
              onClick={() => setSelectedDayIdx(idx)}
              style={{
                height: '110px',
                padding: '12px',
                borderRadius: '16px',
                cursor: 'pointer',
                background: isActive ? 'rgba(128, 128, 128, 0.15)' : 'rgba(128, 128, 128, 0.05)',
                border: `1px solid ${isActive ? 'var(--card-border)' : 'transparent'}`,
                minWidth: isActive ? '220px' : '100px',
                display: 'flex',
                flexDirection: isActive ? 'row' : 'column',
                justifyContent: 'space-between',
                alignItems: isActive ? 'center' : 'stretch',
                transition: 'all 0.3s ease',
                flexShrink: 0
              }}
            >
              {isActive ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-1)' }}>{dayNum}</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-2)' }}>{dayLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                      <div style={{ background: 'rgba(56, 189, 248, 0.15)', borderRadius: '50%', padding: '8px', zIndex: 2, border: '1px solid var(--card-border)' }}>
                        <WeatherIcon code={day.weather_code} size={32} />
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(day.temp_max)}°</span>
                    <span style={{ fontSize: '16px', color: 'var(--text-3)' }}>{Math.round(day.temp_min)}°</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-2)' }}>{dayNum}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{dayLabel}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <WeatherIcon code={day.weather_code} size={28} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(day.temp_max)}°</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{Math.round(day.temp_min)}°</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Chart Section Header */}
      <div style={{ background: 'rgba(128, 128, 128, 0.08)', borderRadius: '24px', padding: '24px', marginTop: '8px', border: '1px solid var(--panel-sep)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: 'var(--text-1)', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            {currentTab.label}
          </h3>
          
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
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Temperature</span>
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
