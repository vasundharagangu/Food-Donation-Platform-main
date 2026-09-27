import axios from 'axios';
import { toast } from 'react-toastify';

// Use explicit backend API URL to avoid relying on CRA proxy
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
});

// Inject token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ww_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Request failed';
    
    // Handle 401 errors by clearing token and redirecting to login
    if (err.response?.status === 401) {
      localStorage.removeItem('ww_token');
      localStorage.removeItem('ww_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }
    
    // Handle 403 errors (access denied) with better error messages
    if (err.response?.status === 403) {
      const errorMsg = err.response?.data?.message || 'Access denied. Please check your permissions.';
      toast.error(errorMsg);
      console.error('Access denied error:', err.response?.data || err);
      return Promise.reject(err);
    }
    
    // Handle other errors
    if (err.response?.status !== 401) {
      toast.error(msg);
    }
    
    return Promise.reject(err);
  }
);

export default api;
