export const STATUS_CONFIG = {
  active:      { color: '#52c41a', label: 'Active',      category: 'working',   icon: '🟢' },
  on_mission:  { color: '#1890ff', label: 'On Mission',  category: 'working',   icon: '🔵' },
  idle:        { color: '#8c8c8c', label: 'Idle',        category: 'available', icon: '⚪' },
  charging:    { color: '#faad14', label: 'Charging',    category: 'available', icon: '🟡' },
  blocked:     { color: '#fa8c16', label: 'Blocked',     category: 'attention', icon: '🟠' },
  maintenance: { color: '#722ed1', label: 'Maintenance', category: 'attention', icon: '🟣' },
  error:       { color: '#ff4d4f', label: 'Error',       category: 'critical',  icon: '🔴' },
  offline:     { color: '#434343', label: 'Offline',     category: 'critical',  icon: '⚫' },
};
