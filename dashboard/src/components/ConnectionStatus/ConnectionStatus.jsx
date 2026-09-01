import React from 'react';
import { Badge, Tooltip } from 'antd';
import { useSelector } from 'react-redux';

const ConnectionStatus = () => {
  const connected = useSelector(state => state.fleet.connected);
  const lastUpdate = useSelector(state => state.fleet.lastUpdate);

  const status = connected ? 'success' : 'error';
  const text = connected ? 'Connected (Live)' : 'Disconnected (Reconnecting...)';
  
  const lastUpdateText = lastUpdate 
    ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
    : 'No data received yet';

  return (
    <Tooltip title={lastUpdateText}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 16 }}>
        <Badge status={status} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{text}</span>
      </div>
    </Tooltip>
  );
};

export default ConnectionStatus;
