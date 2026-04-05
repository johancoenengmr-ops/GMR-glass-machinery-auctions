import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Resolve an image URL. Uploaded images are stored as relative paths
 * (/uploads/...) and need the backend base URL prepended.
 */
export function getImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/uploads/')) return `${API_BASE}${imageUrl}`;
  return imageUrl;
}

export default api;
