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
import api, { endpoints } from '../../configs/API/config';

const Home = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredRestaurants, setFeaturedRestaurants] = useState([]);
  const [recommendedDishes, setRecommendedDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hàm gọi API lấy danh sách cửa hàng nổi bật
  const fetchFeaturedRestaurants = async () => {
    try {
      const response = await api.get(endpoints.restaurants);
      setFeaturedRestaurants(response.data);
    } catch (err) {
      setError('Không thể tải danh sách cửa hàng');
      console.error(err);
    }
  };

  // Hàm gọi API lấy danh sách món ăn đề xuất
  const fetchRecommendedDishes = async () => {
    try {
      const response = await api.get(endpoints.dishes);
      setRecommendedDishes(response.data);
    } catch (err) {
      setError('Không thể tải danh sách món ăn');
      console.error(err);
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
    navigation.navigate('SearchResults', { 
      query: searchQuery,
      endpoint: endpoints.search
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
  const DishCard = ({ dish }) => (
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
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm món ăn, nhà hàng..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
      </View>

      <ScrollView>
        {/* Phần cửa hàng nổi bật */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cửa hàng nổi bật</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredRestaurants.map(restaurant => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </ScrollView>
        </View>

        {/* Phần món ăn đề xuất */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Món ăn đề xuất</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedDishes.map(dish => (
              <DishCard key={dish.id} dish={dish} />
            ))}
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
  searchInput: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
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
});

export default Home;
