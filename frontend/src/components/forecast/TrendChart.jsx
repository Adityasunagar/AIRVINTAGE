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

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div style={{ 
        background: 'var(--card-bg)', 
        backdropFilter: 'blur(12px)', 
        border: '1px solid var(--card-border)', 
        padding: '10px 14px', 
        borderRadius: '12px', 
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)' 
      }}>
        <p style={{ color: 'var(--text-3)', fontSize: '11px', margin: '0 0 4px 0' }}>
          {new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p style={{ color: 'var(--text-1)', fontWeight: 'bold', fontSize: '16px', margin: 0 }}>
          {val != null ? `${Number(val).toFixed(1)}${unit}` : 'N/A'}
        </p>
      </div>
    );
  }
  return null;
};

const CustomXTick = ({ x, y, payload }) => {
  if (!payload || payload.value == null) return null;
  const d = new Date(payload.value);
  const h = d.getHours();
  // Show every 3 hours: 0, 3, 6, 9, 12, 15, 18, 21
  if (h % 3 !== 0) return null;
  const label = d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0}
        textAnchor="middle"
        fill="var(--text-3)"
        fontSize={11}
        fontWeight="500"
      >
        {label}
      </text>
    </g>
  );
};

const TrendChart = ({ data, dataKey, color, unit, gradientId }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        width: '100%', height: '200px', marginTop: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '8px',
        background: 'rgba(128,128,128,0.04)', borderRadius: '16px',
        border: '1px dashed var(--panel-sep)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
          <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-7"/>
        </svg>
        <span style={{ color: 'var(--text-3)', fontSize: '13px' }}>No data for this day</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '280px', marginTop: '8px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.55} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-sep)" vertical={false} opacity={0.5} />

          <XAxis
            dataKey="time"
            orientation="bottom"
            tick={<CustomXTick />}
            axisLine={false}
            tickLine={false}
            interval={2}
            height={28}
          />

          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip unit={unit} />} wrapperStyle={{ outline: 'none' }} />

          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            animationDuration={800}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: 'var(--card-bg)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
