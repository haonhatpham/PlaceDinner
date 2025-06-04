import axios from 'axios';

// Cấu hình base URL cho API
export const BASE_URL = 'http://192.168.100.22:8000';

// Hàm xử lý URL ảnh
export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${BASE_URL}${imagePath}`;
};

// Định nghĩa các endpoint
export const endpoints = {
    'login': '/o/token/',
    'current-user': '/users/current_user/',
    'register': '/users/',

    'stores': '/stores/',
    'store_detail': (id) => `/stores/${id}/`,
    'store-reviews': (id) => `/stores/${id}/reviews/`,
    'store-follow': (id) => `/stores/${id}/follow/`,
    'store-check-following': (id) => `/stores/${id}/check_following/`,
    'store-following': '/stores/following/',
    'update-opening-hours': (id) => `/stores/${id}/update_opening_hours/`,

    'foods': '/foods/',
    'food_detail': (id) => `/foods/${id}/`,
    'store-foods':'/foods/my-store/',
    'update-food-availability': (id) => `/foods/${id}/update_availability/`,
    
    'categories': '/categories/',


    'menus': '/menus/',                    
    'store-menus': '/menus/my-store/',    
    'store-menu-detail': (id) => `/menus/${id}/detail/`,

    'create-order': '/orders/',
    'user-orders': '/orders/my-orders/',
    'order-detail': (id) => `/orders/${id}/`,
    'store-orders': '/orders/my-store/',
    'store-categories': (id) => `/stores/${id}/categories/`,
    'confirm-order':(id) => `/orders/${id}/confirm/`,
    'deliver-order':(id) => `/orders/${id}/deliver/`,

    'store-stats': (id) => `/stores/${id}/stats/`,
    'store-revenue': (id) => `/stores/${id}/revenue/`,
    'store-foods-stats': (id) => `/stores/${id}/foods/stats/`,
    'store-categories-stats': (id) => `/stores/${id}/categories/stats/`,
    'store-orders-stats': (id) => `/stores/${id}/orders/stats/`,
    'store-revenue-stats': (id) => `/stores/${id}/revenue/stats/`,
    'store-foods-revenue': (id) => `/stores/${id}/foods/revenue/`,
    'store-categories-revenue': (id) => `/stores/${id}/categories/revenue/`,
    'store-orders-revenue': (id) => `/stores/${id}/orders/revenue/`,
    'store-revenue-revenue': (id) => `/stores/${id}/revenue/revenue/`,
    'update-order-status': (orderId) => `/store/orders/${orderId}/status/`,
    'create-payment': '/payments/create/',
    'momo-webhook': '/momo/webhook/',
}; 

export const authApi = (token) => {
    const api = axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    // Add request interceptor
    api.interceptors.request.use(
        (config) => {
            // Ensure token is in headers
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Add response interceptor
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                // Token expired or invalid
                console.error('Authentication error:', error);
            }
            return Promise.reject(error);
        }
    );

    return api;
};

// Create an instance without auth for public endpoints
export default axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

