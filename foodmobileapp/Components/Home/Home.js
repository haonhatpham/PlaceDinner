import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { endpoints } from '../../configs/Apis';
import Icon from 'react-native-vector-icons/Ionicons';

const Home = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredRestaurants, setFeaturedRestaurants] = useState([]);
  const [recommendedDishes, setRecommendedDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API lấy danh sách cửa hàng nổi bật
  const fetchFeaturedRestaurants = async () => {
    try {
      const response = await api.get(endpoints.stores);
      if (response.data && Array.isArray(response.data)) {
        const restaurants = response.data.map(store => ({
          id: store.id,
          name: store.name,
          image: store.image || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png', // Ảnh mặc định nếu không có
          cuisine: store.description || 'Không xác định',
          rating: 'Chưa có đánh giá',
          address: store.address,
          opening_hours: store.opening_hours
        }));
        setFeaturedRestaurants(restaurants);
      } else {
        console.log('Invalid restaurant data structure:', response.data);
        setFeaturedRestaurants([]);
        setError('Dữ liệu cửa hàng không hợp lệ');
      }
    } catch (err) {
      console.error('Restaurant API Error:', err.response?.data || err.message);
      setError('Không thể tải danh sách cửa hàng');
      setFeaturedRestaurants([]);
    }
  };

  // Hàm gọi API lấy danh sách món ăn đề xuất
  const fetchRecommendedDishes = async () => {
    try {
      const response = await api.get(endpoints.foods);
      if (response.data && response.data.results && Array.isArray(response.data.results)) {
        setRecommendedDishes(response.data.results);
      } else {
        setRecommendedDishes([]);
        setError('Dữ liệu món ăn không hợp lệ');
      }
    } catch (err) {
      console.error('Food API Error:', err.response?.data || err.message);
      setError('Không thể tải danh sách món ăn');
      setRecommendedDishes([]);
    }
  };

  // Gọi API khi component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchFeaturedRestaurants(),
          fetchRecommendedDishes()
        ]);
      } catch (err) {
        setError('Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Hàm tìm kiếm
  const handleSearch = () => {
    navigation.navigate('Search', { 
      query: searchQuery,
      endpoint: endpoints.foods
    });
  };

  // Component hiển thị cửa hàng
  const RestaurantCard = ({ restaurant }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('RestaurantDetail', { 
        id: restaurant.id,
        endpoint: endpoints['restaurant-detail'](restaurant.id)
      })}
    >
      <Image 
        source={{ uri: restaurant.image }} 
        style={styles.cardImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{restaurant.name}</Text>
        <Text style={styles.cardSubtitle}>{restaurant.cuisine}</Text>
        <Text style={styles.cardRating}>⭐ {restaurant.rating}</Text>
      </View>
    </TouchableOpacity>
  );

  // Component hiển thị món ăn
  const DishCard = ({ dish }) => {
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('DishDetail', { 
          id: dish.id,
          endpoint: endpoints['dish-detail'](dish.id)
        })}
      >
        <Image 
          source={{ uri: dish.image }} 
          style={styles.cardImage}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{dish.name}</Text>
          <Text style={styles.cardPrice}>{dish.price.toLocaleString('vi-VN')}đ</Text>
          <Text style={styles.cardRestaurant}>{dish.restaurant_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header với thanh tìm kiếm */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
        >
          <Icon name="search" size={24} color="#666" />
          <Text style={styles.searchPlaceholder}>Tìm kiếm món ăn, nhà hàng...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Phần cửa hàng nổi bật */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cửa hàng nổi bật</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredRestaurants && featuredRestaurants.length > 0 ? (
              featuredRestaurants.map(restaurant => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))
            ) : (
              <Text style={styles.emptyText}>Không có cửa hàng nào</Text>
            )}
          </ScrollView>
        </View>

        {/* Phần món ăn đề xuất */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Món ăn đề xuất</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedDishes && recommendedDishes.length > 0 ? (
              recommendedDishes.map(dish => (
                <DishCard key={dish.id} dish={dish} />
              ))
            ) : (
              <Text style={styles.emptyText}>Không có món ăn nào</Text>
            )}
          </ScrollView>
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
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 40,
  },
  searchPlaceholder: {
    marginLeft: 8,
    color: '#666',
    fontSize: 16,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  card: {
    width: 200,
    marginRight: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cardRating: {
    fontSize: 14,
    color: '#f39c12',
  },
  cardPrice: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardRestaurant: {
    fontSize: 12,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
    fontStyle: 'italic'
  },
});

export default Home;
