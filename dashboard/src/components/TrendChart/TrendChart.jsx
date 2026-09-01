import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Segmented, Spin, Typography } from 'antd';
import { fetchTrends } from '../../store/slices/trendsSlice';
import { STATUS_CONFIG } from '../../utils/statusConfig';

const { Title } = Typography;

const TrendChart = () => {
  const dispatch = useDispatch();
  const { data, window, loading } = useSelector(state => state.trends);

  useEffect(() => {
    dispatch(fetchTrends(window));
  }, [dispatch, window]);

  const handleWindowChange = (val) => {
    dispatch(fetchTrends(val));
  };

  const chartData = data.map(d => ({
    ...d,
    timeLabel: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="recharts-default-tooltip" style={{ padding: '10px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span>{entry.name}:</span>
              <strong>{entry.value}</strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>Fleet Status Trends</Title>
        <Segmented 
          options={[
            { label: '1m', value: 60 },
            { label: '5m', value: 300 },
            { label: '15m', value: 900 },
            { label: '30m', value: 1800 },
          ]} 
          value={window}
          onChange={handleWindowChange}
        />
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
            <Spin />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timeLabel" tick={{ fill: 'var(--text-secondary)' }} tickMargin={10} minTickGap={30} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} />
            <Tooltip content={<CustomTooltip />} />
            
            <Area type="monotone" dataKey="working" stackId="1" stroke={STATUS_CONFIG.active.color} fill={STATUS_CONFIG.active.color} name="Working" />
            <Area type="monotone" dataKey="idle" stackId="1" stroke={STATUS_CONFIG.idle.color} fill={STATUS_CONFIG.idle.color} name="Idle" />
            <Area type="monotone" dataKey="attention" stackId="1" stroke={STATUS_CONFIG.blocked.color} fill={STATUS_CONFIG.blocked.color} name="Needs Attention" />
            <Area type="monotone" dataKey="critical" stackId="1" stroke={STATUS_CONFIG.error.color} fill={STATUS_CONFIG.error.color} name="Critical" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrendChart;
