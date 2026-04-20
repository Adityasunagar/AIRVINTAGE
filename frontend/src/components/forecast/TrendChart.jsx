import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import WeatherIcon from './WeatherIcon';

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ 
        background: 'var(--card-bg)', 
        backdropFilter: 'blur(12px)', 
        border: '1px solid var(--card-border)', 
        padding: '12px', 
        borderRadius: '12px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)' 
      }}>
        <p style={{ color: 'var(--text-3)', fontSize: '10px', margin: '0 0 4px 0' }}>
          {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style={{ color: 'var(--text-1)', fontWeight: 'bold', fontSize: '16px', margin: 0 }}>
          {payload[0].value.toFixed(1)}{unit}
        </p>
      </div>
    );
  }
  return null;
};

const CustomAxisTick = ({ x, y, payload, data }) => {
  const d = new Date(payload.value);
  // Only show every 2 hours
  if (d.getHours() % 2 !== 0 && d.getHours() !== 0) return null;
  
  const point = data.find(item => item.time === payload.value);
  if (!point) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={-45} textAnchor="middle" fill="var(--text-3)" fontSize={10}>
        {d.toLocaleTimeString([], { hour: 'numeric', hour12: true })}
      </text>
      <foreignObject x={-10} y={-40} width={20} height={20}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', opacity: 0.8 }}>
          <WeatherIcon code={point.weather_code} size={14} />
        </div>
      </foreignObject>
      <text x={0} y={-5} textAnchor="middle" fill="var(--text-1)" fontSize={12} fontWeight="bold">
        {Math.round(point.temp)}°
      </text>
    </g>
  );
};

const TrendChart = ({ data, dataKey, color, unit, gradientId }) => {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: '320px', marginTop: '16px', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 70, right: 10, left: 10, bottom: 20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.6} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-sep)" vertical={false} opacity={0.5} />
          
          <XAxis 
            dataKey="time" 
            orientation="top"
            tick={<CustomAxisTick data={data} />}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip unit={unit} />} wrapperStyle={{ outline: 'none' }} />
          
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={3}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            animationDuration={1500}
            baseLine={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
