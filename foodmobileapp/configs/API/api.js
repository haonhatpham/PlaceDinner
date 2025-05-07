import axios from 'axios';

// Cấu hình base URL cho API
const BASE_URL = 'http://192.168.100.86:8000';

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
    'food-categories':`/food-categories/`,
    'dish-reviews': (foodId) => `/foods/${foodId}/reviews/`,

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