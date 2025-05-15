import axios from 'axios';

// Cấu hình base URL cho API
export const BASE_URL = 'http://192.168.100.86:8000';

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
    'foods': '/foods/',
    'categories': '/categories/',
    'orders': '/orders/',
    'order-detail': (id) => `/orders/${id}/`,
    'create-order': '/orders/',
    'update-order': (id) => `/orders/${id}/`,
    'delete-order': (id) => `/orders/${id}/`,
    'user-orders': '/orders/user/',
    'store-orders': '/orders/store/',
    'store-foods': (id) => `/stores/${id}/foods/`,
    'store-categories': (id) => `/stores/${id}/categories/`,
    'store-orders': (id) => `/stores/${id}/orders/`,
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
}; 

export const authApi = (token) => {
    return axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
}

export default axios.create({
    baseURL: BASE_URL
})


