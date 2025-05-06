import axios from 'axios';

// Cấu hình base URL cho API
const BASE_URL = 'http://192.168.100.22:8000/';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Thêm interceptor để xử lý token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Định nghĩa các endpoint
export const endpoints = {
    // Authentication
    'login': '/o/token/',
    'register': '/users/',
    'current-user': '/users/current-user/',
    'refresh-token': '/o/token/refresh/',

    // Restaurant Management
    'restaurants': '/restaurants/',
    'restaurant-detail': (id) => `/restaurants/${id}/`,
    'restaurant-dishes': (restaurantId) => `/restaurants/${restaurantId}/dishes/`,
    'restaurant-reviews': (restaurantId) => `/restaurants/${restaurantId}/reviews/`,
    'restaurant-stats': (restaurantId) => `/restaurants/${restaurantId}/stats/`,
    'restaurant-orders': (restaurantId) => `/restaurants/${restaurantId}/orders/`,

    // Dish Management
    'dishes': '/dishes/',
    'dish-detail': (id) => `/dishes/${id}/`,
    'dish-categories': '/dish-categories/',
    'dish-reviews': (dishId) => `/dishes/${dishId}/reviews/`,
    'dish-ratings': (dishId) => `/dishes/${dishId}/ratings/`,

    // Order Management
    'orders': '/orders/',
    'order-detail': (id) => `/orders/${id}/`,
    'order-items': (orderId) => `/orders/${orderId}/items/`,
    'order-status': (orderId) => `/orders/${orderId}/status/`,
    'order-payment': (orderId) => `/orders/${orderId}/payment/`,

    // User Management
    'user-profile': '/users/profile/',
    'user-orders': '/users/orders/',
    'user-favorites': '/users/favorites/',
    'user-following': '/users/following/',
    'user-notifications': '/users/notifications/',

    // Review & Rating
    'reviews': '/reviews/',
    'review-detail': (id) => `/reviews/${id}/`,
    'ratings': '/ratings/',
    'rating-detail': (id) => `/ratings/${id}/`,

    // Search & Filter
    'search': '/search/',
    'search-restaurants': '/search/restaurants/',
    'search-dishes': '/search/dishes/',
    'filter-dishes': '/dishes/filter/',
    'filter-restaurants': '/restaurants/filter/',

    // Payment
    'payment-methods': '/payment/methods/',
    'payment-process': '/payment/process/',
    'payment-status': (orderId) => `/payment/${orderId}/status/`,

    // Notification
    'notifications': '/notifications/',
    'notification-settings': '/notifications/settings/',
    'notification-mark-read': (id) => `/notifications/${id}/mark-read/`,

    // Map & Location
    'locations': '/locations/',
    'location-detail': (id) => `/locations/${id}/`,
    'nearby-restaurants': '/restaurants/nearby/',
};

export default api;