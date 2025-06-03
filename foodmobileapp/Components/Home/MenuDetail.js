import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import api, { endpoints, authApi } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MyUserContext } from '../../configs/Contexts';

const MenuDetail = ({ route, navigation }) => {
  const { menuId, name, menu_type } = route.params;
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [foods, setFoods] = useState([]);
  const [store, setStore] = useState(null);
  const user = useContext(MyUserContext);

  useEffect(() => {
    if (!menuId) {
      setError('Không tìm thấy ID menu');
      setLoading(false);
      return;
    }
    loadMenuDetail();
  }, [menuId]);

  const loadFoodDetails = async (foodIds) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const auth = authApi(token);
      const foodPromises = foodIds.map(id => 
        auth.get(endpoints['food_detail'](id))
          .then(response => response.data)
          .catch(err => {
            console.error(`Error loading food ${id}:`, err);
            return null;
          })
      );
      
      const foodDetails = await Promise.all(foodPromises);
      setFoods(foodDetails.filter(food => food !== null));
    } catch (err) {
      console.error('Error loading food details:', err);
    }
  };

  const loadStoreDetails = async (storeId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const auth = authApi(token);
      const response = await auth.get(endpoints['store_detail'](storeId));
      setStore(response.data);
    } catch (err) {
      console.error('Error loading store details:', err);
    }
  };

  const loadMenuDetail = async () => {
    try {
      setLoading(true);
      console.log('Loading menu detail for menuId:', menuId);
      
      const token = await AsyncStorage.getItem('token');
      console.log('Token from AsyncStorage:', token ? 'Token exists' : 'No token found');
      
      if (!token) {
        console.log('No token found, redirecting to login');
        setError('Vui lòng đăng nhập để xem chi tiết menu');
        setLoading(false);
        return;
      }

      const auth = authApi(token);
      const endpoint = endpoints['store-menu-detail'](menuId);
      console.log('Making API call to:', endpoint);
      
      const response = await auth.get(endpoint);
      console.log('Menu Detail Response:', response.data);
      
      if (response.data) {
        setMenu(response.data);
        // Load food details if we have food IDs
        if (response.data.foods && response.data.foods.length > 0) {
          await loadFoodDetails(response.data.foods);
        }
        // Load store details if we have store ID
        if (response.data.store) {
          await loadStoreDetails(response.data.store);
        }
        setError(null);
      } else {
        setError('Không tìm thấy thông tin menu');
      }
    } catch (err) {
      console.error('Menu Detail Error:', err);
      console.error('Error details:', {
        status: err.response?.status,
        message: err.message,
        data: err.response?.data,
        endpoint: endpoints['store-menu-detail'](menuId)
      });
      
      if (err.response?.status === 401) {
        console.log('Token expired or invalid, redirecting to login');
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (err.response?.status === 404) {
        setError('Không tìm thấy thông tin menu');
      } else if (err.response?.status === 400) {
        setError('Dữ liệu không hợp lệ');
      } else {
        setError('Không thể tải thông tin menu');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFoodItem = ({ item }) => {
    if (!item) return null;

    return (
      <TouchableOpacity 
        style={styles.foodItem}
        onPress={() => navigation.navigate('DishDetail', { 
          id: item.id,
          name: item.name,
          storeId: item.store
        })}
      >
        <Image 
          source={{ uri: item.image || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-food.png' }} 
          style={styles.foodImage} 
        />
        <View style={styles.foodInfo}>
          <Text style={styles.foodName}>{item.name || 'Không có tên'}</Text>
          <Text style={styles.foodPrice}>{item.price?.toLocaleString('vi-VN') || '0'}đ</Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>
              {item.average_rating ? item.average_rating : 'Chưa có đánh giá'}
            </Text>
            {item.review_count > 0 && (
              <Text style={styles.reviewCount}>({item.review_count} đánh giá)</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Đang tải thông tin menu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMenuDetail}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!menu) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy thông tin menu</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{menu?.name || 'Menu'}</Text>
        </View>

        {/* Store Info */}
        {store && (
          <TouchableOpacity 
            style={styles.storeInfo}
            onPress={() => navigation.navigate('StoreDetail', { 
              id: store.id,
              name: store.name
            })}
          >
            <Image 
              source={{ uri: store.avatar || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png' }} 
              style={styles.storeImage} 
            />
            <View style={styles.storeDetails}>
              <Text style={styles.storeName}>{store.name || 'Không có tên cửa hàng'}</Text>
              <Text style={styles.storeAddress}>{store.address || 'Không có địa chỉ'}</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {store.average_rating ? store.average_rating : 'Chưa có đánh giá'}
                </Text>
                {store.review_count > 0 && (
                  <Text style={styles.reviewCount}>({store.review_count} đánh giá)</Text>
                )}
              </View>
            </View>
            <Icon name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        )}

        {/* Menu Info */}
        <View style={styles.menuInfo}>
          <View style={styles.menuTypeContainer}>
            <Icon name="restaurant" size={20} color="#666" />
            <Text style={styles.menuType}>{menu?.menu_type || 'Không có loại menu'}</Text>
          </View>
          <Text style={styles.foodCount}>{foods.length} món</Text>
        </View>

        {/* Foods List */}
        <View style={styles.foodsSection}>
          <Text style={styles.sectionTitle}>Danh sách món ăn</Text>
          <FlatList
            data={foods}
            renderItem={renderFoodItem}
            keyExtractor={(item) => item?.id?.toString() || Math.random().toString()}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  storeImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  storeDetails: {
    flex: 1,
    marginLeft: 15,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  menuInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuType: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  foodCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  foodsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  foodItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  foodInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  foodName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  foodPrice: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#f39c12',
    marginLeft: 5,
  },
  reviewCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
});

export default MenuDetail; 