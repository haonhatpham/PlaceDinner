import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, Chip } from 'react-native-paper';
import api, { endpoints, authApi } from '../../configs/Apis';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const Home = ({ navigation }) => {
  // States cho Featured Restaurants
  const [featuredRestaurants, setFeaturedRestaurants] = useState([]);
  // States cho Recommended Dishes với pagination
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [menus, setMenus] = useState([]);

  // Sử dụng useFocusEffect để tải lại dữ liệu khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, refreshing data...');
      // Khi màn hình được focus, reset page về 1 và tải lại món ăn
      setPage(1);
      // Không cần reset dishes ở đây, loadDishes sẽ xử lý
      // loadDishes() // loadDishes sẽ được gọi bởi useEffect theo dõi page
    }, [])
  );

  // Load Featured Restaurants
  const fetchFeaturedRestaurants = async () => {
    try {
      const response = await api.get(endpoints.stores);
      if (response.data && Array.isArray(response.data)) {
        const restaurants = response.data.map(store => {
          // Tính trung bình rating từ reviews
          let averageRating = 0;
          let reviewCount = 0;
          
          if (store.reviews && store.reviews.length > 0) {
            const totalRating = store.reviews.reduce((sum, review) => sum + review.rating, 0);
            reviewCount = store.reviews.length;
            averageRating = (totalRating / reviewCount).toFixed(1);
          }

          return {
            id: store.id,
            name: store.name,
            image: store.avatar || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png',
            cuisine: store.description || 'Không xác định',
            rating: reviewCount > 0 ? averageRating : 'Chưa có đánh giá',
            review_count: reviewCount,
            address: store.address,
            opening_hours: store.opening_hours
          };
        });
        setFeaturedRestaurants(restaurants);
      }
    } catch (err) {
      console.error('Restaurant API Error:', err);
      setError('Không thể tải danh sách cửa hàng');
    }
  };

  // Load Categories (nếu có API)
  const loadCategories = async () => {
    try {
      // Giả sử có API categories, nếu không thì bỏ qua
      // const response = await api.get(endpoints.categories);
      // setCategories(response.data);
    } catch (err) {
      console.error('Categories Error:', err);
    }
  };

  // Load Dishes với pagination và search
  const loadDishes = async () => {
    if (page > 0) {
      if (!endpoints.foods) {
        console.log('Foods endpoint not available');
        return;
      }

      let url = `${endpoints.foods}?page=${page}`;
      
      if (searchQuery) {
        url += `&search=${searchQuery}`;
      }
      
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }

      try {
        setLoading(true);
        const response = await api.get(url);
        
        // Kiểm tra cấu trúc response
        let results = [];
        let hasNext = false;
        
        if (response.data && response.data.results && Array.isArray(response.data.results)) {
          results = response.data.results.map(food => {
            // Tính trung bình rating từ reviews
            let averageRating = 0;
            let reviewCount = 0;
            
            if (food.reviews && food.reviews.length > 0) {
              const totalRating = food.reviews.reduce((sum, review) => sum + review.rating, 0);
              reviewCount = food.reviews.length;
              averageRating = (totalRating / reviewCount).toFixed(1);
            }

            return {
              ...food,
              average_rating: reviewCount > 0 ? averageRating : null,
              review_count: reviewCount
            };
          });
          hasNext = !!response.data.next;
          
          // Nếu không có next hoặc results rỗng, dừng pagination
          if (!hasNext || results.length === 0) {
            setPage(0);
            setHasMore(false);
          } else {
            setHasMore(true);
          }
        } else if (response.data && Array.isArray(response.data)) {
          results = response.data.map(food => {
            // Tính trung bình rating từ reviews
            let averageRating = 0;
            let reviewCount = 0;
            
            if (food.reviews && food.reviews.length > 0) {
              const totalRating = food.reviews.reduce((sum, review) => sum + review.rating, 0);
              reviewCount = food.reviews.length;
              averageRating = (totalRating / reviewCount).toFixed(1);
            }

            return {
              ...food,
              average_rating: reviewCount > 0 ? averageRating : null,
              review_count: reviewCount
            };
          });
          setPage(0); // Không có pagination
          setHasMore(false);
        } else {
          console.log('No valid data in response');
          setPage(0);
          setHasMore(false);
          return;
        }
        
        setDishes(page === 1 ? results : [...dishes, ...results]);
        console.log('Loaded:', results.length, 'items. Has more:', hasNext);
        
      } catch (err) {
        console.error('Food API Error:', err.response?.status, err.response?.data || err.message);
        
        // Set page = 0 và hasMore = false khi có lỗi
        setPage(0);
        setHasMore(false);
        
        if (err.response?.status === 404) {
          console.log('No more pages available');
          if (page === 1) {
            setError('API món ăn chưa được triển khai');
          }
        } else {
          setError('Không thể tải danh sách món ăn');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Load Menus
  const loadMenus = async () => {
    try {
      if (!endpoints.menus) {
        console.log('Menus endpoint not available');
        return;
      }

      const response = await api.get(endpoints.menus);
      console.log('Menus API Response:', response.data); // Debug log
      
      if (response.data && Array.isArray(response.data)) {
        const formattedMenus = response.data.map(menu => ({
          id: menu.id,
          name: menu.name || 'Menu không tên',
          menu_type: menu.menu_type || 'Không xác định',
          items_count: menu.foods?.length || 0,
          price: menu.total_price || 0,
          average_rating: menu.average_rating || 0,
          store: menu.store || {},
          image: menu.image || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-menu.png',
          description: menu.description || 'Không có mô tả'
        }));
        console.log('Formatted Menus:', formattedMenus); // Debug log
        setMenus(formattedMenus);
      } else {
        console.log('Invalid menus data format:', response.data);
        setMenus([]);
      }
    } catch (err) {
      console.error('Menu API Error:', err.message);
      setMenus([]);
      setError('Không thể tải danh sách menu');
    }
  };

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      try {
        await fetchFeaturedRestaurants();
        await loadCategories();
        await loadMenus();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Load dishes with debounce
  useEffect(() => {
    if (endpoints.foods) {
      const timer = setTimeout(() => {
        loadDishes();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [searchQuery, selectedCategory, page]);

  // Reset when search/filter changes
  useEffect(() => {
    if (endpoints.foods) {
      setPage(1);
      setDishes([]);
      setHasMore(true); // Reset hasMore
    }
  }, [searchQuery, selectedCategory]);

  // Load more dishes với protection tốt hơn
  const loadMore = () => {
    // Chỉ load more khi:
    // 1. Không đang loading
    // 2. Có page > 0 (tức là còn data để load)
    // 3. Có hasMore = true
    // 4. Đã có ít nhất 1 item (để tránh trigger ngay lập tức)
    if (!loading && page > 0 && hasMore && dishes.length > 0) {
      setPage(page + 1);
    }
  };

  const handleOrderNow = (food) => {
    if (!user) {
      Alert.alert(
        'Thông báo',
        'Vui lòng đăng nhập để đặt hàng',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Đăng nhập') }
        ]
      );
      return;
    }

    navigation.navigate('Trang chủ', {
      screen: 'Order',
      params: {
        foods: [{
          ...food,
          quantity: 1,
          note: ''
        }],
        directOrder: true
      }
    });
  };

  // Restaurant Card Component
  const RestaurantCard = ({ restaurant }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('StoreDetail', { 
        id: restaurant.id,
        name: restaurant.name
      })}
    >
      <Image source={{ uri: restaurant.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{restaurant.name}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>{restaurant.cuisine}</Text>
        <View style={styles.ratingContainer}>
          <Icon name="star" size={16} color="#FFD700" />
          <Text style={styles.ratingText}>{restaurant.rating}</Text>
          {restaurant.review_count > 0 && (
            <Text style={styles.reviewCount}>({restaurant.review_count} đánh giá)</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Dish Item cho FlatList
  const DishItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.dishItem}
      onPress={() => navigation.navigate('DishDetail', { 
        id: item.id,
        name: item.name,
        storeId: item.store
      })}
    >
      <Image source={{ uri: item.image }} style={styles.dishImage} />
      <View style={styles.dishContent}>
        <Text style={styles.dishTitle}>{item.name}</Text>
        <Text style={styles.dishPrice}>{parseFloat(item.price)?.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</Text>
        <Text style={styles.dishRestaurant}>{item.restaurant_name}</Text>
        {/* Rating */}
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

  // Menu Card Component
  const MenuCard = ({ menu }) => {
    console.log('Menu data in MenuCard:', menu); // Debug log để kiểm tra dữ liệu menu
    
    return (
      <TouchableOpacity 
        style={styles.menuCard}
        onPress={() => {
          if (!menu.id) {
            console.error('Menu ID is missing:', menu);
            return;
          }
          console.log('Navigating to MenuDetail with menuId:', menu.id);
          navigation.navigate('MenuDetail', { 
            menuId: menu.id,
            name: menu.name,
            menu_type: menu.menu_type
          });
        }}
      >
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>{menu.name}</Text>
          <View style={styles.menuInfo}>
            <Text style={styles.menuType}>{menu.menu_type}</Text>
            <Text style={styles.menuItems}>{menu.items_count} món</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Thêm hàm xử lý khi nhấn vào thanh tìm kiếm
  const handleSearchPress = () => {
    navigation.navigate('Search', { query: searchQuery });
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header với thanh tìm kiếm */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Tìm kiếm món ăn..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
          onPress={handleSearchPress}
        />
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Phần cửa hàng nổi bật */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cửa hàng nổi bật</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {featuredRestaurants.map(restaurant => (
                  <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                ))}
              </ScrollView>
            </View>

            {/* Phần Menu */}
            {menus && menus.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Menu đặc biệt</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {menus.map(menu => (
                    <MenuCard key={menu.id} menu={menu} />
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Menu đặc biệt</Text>
                <Text style={styles.emptyText}>Không có menu nào</Text>
              </View>
            )}

            {/* Categories Filter (nếu có) */}
            {categories.length > 0 && (
              <View style={styles.categorySection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                    <Chip 
                      selected={!selectedCategory}
                      style={styles.categoryChip}
                    >
                      Tất cả
                    </Chip>
                  </TouchableOpacity>
                  {categories.map(category => (
                    <TouchableOpacity 
                      key={category.id}
                      onPress={() => setSelectedCategory(category.id)}
                    >
                      <Chip 
                        selected={selectedCategory === category.id}
                        style={styles.categoryChip}
                      >
                        {category.name}
                      </Chip>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Title cho Dishes */}
            <Text style={[styles.sectionTitle, { marginHorizontal: 15, marginTop: 10 }]}>
              Món ăn đề xuất
            </Text>
          </>
        }
        data={dishes}
        renderItem={({ item }) => <DishItem item={item} />}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `temp-${index}`}
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loading && (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color="#0000ff" />
            </View>
          )
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không có món ăn nào</Text>
            </View>
          )
        }
      />

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Icon name="close" size={20} color="#c62828" />
          </TouchableOpacity>
        </View>
      )}
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
    borderRadius: 25,
    elevation: 3,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  // Restaurant Card Styles (giữ nguyên)
  card: {
    width: 200,
    marginRight: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    resizeMode: 'cover',
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
  // Category Styles
  categorySection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  categoryChip: {
    marginRight: 10,
  },
  // Dish Item Styles
  dishItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  dishImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  dishContent: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  dishTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dishPrice: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dishRestaurant: {
    fontSize: 12,
    color: '#666',
  },
  // Loading & Error Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  footerLoading: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#c62828',
    flex: 1,
  },
  // Rating Styles
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
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
  // Menu Card Styles
  menuCard: {
    width: 200,
    marginRight: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 15,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  menuInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuType: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  menuItems: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});

export default Home;