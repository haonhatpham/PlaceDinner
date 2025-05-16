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

    'foods': '/foods/',
    'food_detail': (id) => `/foods/${id}/`,
    'store-foods':'/foods/my-store/',
    
    'categories': '/categories/',

    'create-order': '/orders/',
    'user-orders': '/orders/my-orders/',
    'order-detail': (id) => `/orders/${id}/`,
    'store-orders': '/orders/my-store/',
    'store-categories': (id) => `/stores/${id}/categories/`,
    'store-orders': '/orders/my-store/',
    'confirm-order':(id) => `/orders/${id}/confirm`,
    'deliver-order':(id) => `/orders/${id}/deliver`,

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


