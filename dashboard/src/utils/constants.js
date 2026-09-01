// Determine WebSocket URL dynamically or fallback to localhost
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  return `${protocol}//${host}:3001/ws/fleet`;
};

// Base URL for Axios
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return `http://${window.location.hostname}:3001/api`;
};

export const CONSTANTS = {
  SITE_WIDTH: 900,
  SITE_HEIGHT: 560,
  WS_URL: getWsUrl(),
  API_BASE_URL: getApiUrl(),
};
