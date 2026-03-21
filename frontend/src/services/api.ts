import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// Интерцептор запросов
api.interceptors.request.use(
    (config: any) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: any) => {
        return Promise.reject(error);
    }
);

// Интерцептор ответов
api.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        } else if (error.code === 'ECONNABORTED') {
            console.error('Таймаут запроса:', error.config?.url);
            return Promise.reject(new Error('Таймаут запроса. Проверьте соединение с сервером.'));
        }
        return Promise.reject(error);
    }
);

export default api;