import { endpoints, authApi } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getStoreStatistics = async (storeId, period = 'month', year = null) => {
    try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
            throw new Error('User not authenticated');
        }
        const api = authApi(token);
        // Construct the URL with query parameters
        const params = new URLSearchParams({
            period: period,
            ...(year && { year: year })
        });
        const url = `${endpoints['store-stats'](storeId)}${params.toString() ? `&${params.toString()}` : ''}`;

        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error("Error fetching store statistics:", error);
        throw error.response?.data || error.message;
    }
}; 