import axios from 'axios';

// Cấu hình base URL cho API
const BASE_URL = 'http://192.168.100.22:8000';

// Hàm xử lý URL ảnh
export const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${BASE_URL}${imagePath}`;
};

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
    'store-location': (storeId) => `/store-locations/${storeId}/`,
    'nearby-stores': '/store-locations/nearby_stores/',

    // Dish Management
    'foods_list': '/foods/',
    'food-detail': (id) => `/foods/${id}/`,
    'food-categories': '/food-categories/',
    'dish-reviews': (foodId) => `/foods/${foodId}/reviews/`,

    // Payment
    'create-payment': (orderId) => `/payments/${orderId}/create_payment/`,
    'confirm-payment': (orderId) => `/payments/${orderId}/confirm_payment/`,
    'delivery-fee': (storeId) => `/delivery-fees/${storeId}/calculate_fee/`,

    // Orders
    'orders': '/orders/',
    'my-orders': '/orders/my-orders/',
    'confirm-order': (orderId) => `/stores/my-store/orders/${orderId}/confirm/`,
    'deliver-order': (orderId) => `/stores/my-store/orders/${orderId}/deliver/`,

    // Notifications
    'notifications': '/notifications/',
    'mark-notification-read': (id) => `/notifications/${id}/mark_as_read/`,
    'mark-all-notifications-read': '/notifications/mark_all_as_read/',
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


