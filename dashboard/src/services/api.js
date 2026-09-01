import axios from 'axios';
import { CONSTANTS } from '../utils/constants';

const api = axios.create({
  baseURL: CONSTANTS.API_BASE_URL,
});

api.interceptors.request.use((config) => {
  // Can add token here if auth grows, for now config route passes it explicitly
  return config;
});

export const fleetAPI = {
  getFleet: () => api.get('/fleet').then(res => res.data),
  getRobot: (id) => api.get(`/fleet/${id}`).then(res => res.data),
};

export const trendsAPI = {
  getTrends: (window) => api.get(`/trends?window=${window}`).then(res => res.data),
};

export const configAPI = {
  getConfig: () => api.get('/config').then(res => res.data),
  updateConfig: (data, token) => api.post('/config', data, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => res.data),
};

export const historyAPI = {
  getHistory: (id, from, to) => {
    let url = `/history/${id}?`;
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}`;
    return api.get(url).then(res => res.data);
  }
};

export default api;
