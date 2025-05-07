import axios from 'axios';

// Cấu hình base URL cho API
const BASE_URL = 'http://192.168.100.22:8000';

// Định nghĩa các endpoint
export const endpoints = {
    // Authentication
    'login': '/o/token/',
    'register': '/users/',
    'current-user': '/users/current-user/',
    'refresh-token': '/o/token/refresh/',


    // Restaurant Management
    'stores_list': '/stores/',
    'stores-dishes': (storeId) => `/stores/${storeId}/foods/`,
    'stores-reviews': (storeId) => `/stores/${storeId}/reviews/`,


    // Dish Management
    'foods_list': '/foods/',
    'food-detail': (id) => `/foods/${id}/`,
    'food-categories': '/food-categories/',
    'dish-reviews': (foodId) => `/foods/${foodId}/reviews/`,

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

export const authApi = (token) => {
    return axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
}

export default axios.create({
    baseURL:BASE_URL
})


