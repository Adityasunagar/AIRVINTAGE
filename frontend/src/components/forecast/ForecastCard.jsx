import React, { useState, useEffect } from 'react';
import WeatherIcon from './WeatherIcon';

const ForecastCard = ({ lat, lon, onClick }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lat || !lon) return;

    const fetchForecast = async () => {
      setLoading(true);
      try {
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'http://127.0.0.1:8000';
        const response = await fetch(`${baseUrl}/forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon })
        });
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchForecast();
  }, [lat, lon]);

  if (loading || !data) {
    return (
      <div className="panel" style={{ padding: '24px', opacity: 0.7 }}>
         <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
            Loading forecast...
         </div>
      </div>
    );
  }

  // Extract upcoming 4 days starting from tomorrow or today (idx 1 to 4)
  // idx 0 is Yesterday, idx 1 is Today
  const upcoming = data.daily.slice(1, 5); 

  return (
    <div 
      className="panel" 
      onClick={onClick} 
      style={{ 
        padding: '24px', 
        cursor: 'pointer', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        transition: 'transform 0.2s',
        minWidth: '280px'
      }}
      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)' }}>Extended Forecast</h3>
        <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
             style={{ width: '20px', height: '20px', color: 'var(--accent)' }} viewBox="0 0 24 24">
          <path d="M5 12h14"></path>
          <path d="M12 5l7 7-7 7"></path>
        </svg>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {upcoming.map((day, i) => {
          const dateObj = new Date(day.date);
          let dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          if (i === 0) dayLabel = 'Today';
          if (i === 1) dayLabel = 'Tomorrow';

          return (
            <div key={day.date} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderBottom: i < upcoming.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' 
            }}>
              <div style={{ fontSize: '15px', color: 'var(--text-2)', width: '100px', fontWeight: '500' }}>{dayLabel}</div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                 <WeatherIcon code={day.weather_code} size={26} />
              </div>
              <div style={{ display: 'flex', gap: '16px', width: '80px', justifyContent: 'flex-end', fontSize: '15px' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-1)' }}>{Math.round(day.temp_max)}°</span>
                <span style={{ color: 'var(--text-3)' }}>{Math.round(day.temp_min)}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ForecastCard;
