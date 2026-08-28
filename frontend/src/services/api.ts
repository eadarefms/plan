import axios from 'axios';

// في التطوير المحلي: يُترك فارغًا ويُستعمل proxy الخاص بـ Vite نحو localhost:4000
// في الإنتاج: يُضبط VITE_API_URL على رابط الـ backend المنشور (مثال: https://aref-plan-tracker-api.onrender.com/api)
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!location.pathname.includes('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);
