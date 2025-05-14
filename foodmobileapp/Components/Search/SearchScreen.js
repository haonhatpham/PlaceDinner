import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { authApi, endpoints, BASE_URL } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../configs/Apis';  // Import api mặc định
import { useNavigation, useRoute } from '@react-navigation/native';
import FoodCard from '../Food/FoodCard';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

const SearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const initialQuery = route.params?.query || '';

  // States
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearched, setIsSearched] = useState(false); // Đánh dấu đã từng tìm kiếm

  // Filter states
  const [category, setCategory] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [ordering, setOrdering] = useState('');

  // Build search URL with filters
  const buildSearchUrl = useCallback((customPage) => {
    let url = '/foods/?';
    const params = new URLSearchParams();

    if (searchQuery) params.append('search', searchQuery);
    if (category) params.append('category', category);
    if (mealTime) params.append('meal_time', mealTime);
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);
    if (ordering) params.append('ordering', ordering);
    if ((customPage || page) > 1) params.append('page', customPage || page);

    return url + params.toString();
  }, [searchQuery, category, mealTime, minPrice, maxPrice, ordering, page]);

  // Fetch foods
  const fetchFoods = useCallback(async (isRefreshing = false, customPage = 1) => {
    try {
      if (isRefreshing) {
        setLoading(true);
        setError(null);
        const url = buildSearchUrl(1);
        const response = await api.get(url);
        const { results, count, next } = response.data;
        setFoods(results);
        setTotalCount(count);
        setHasMore(!!next);
        setPage(1);
      } else {
        setLoading(true);
        setError(null);
        const url = buildSearchUrl(customPage);
        const response = await api.get(url);
        const { results, count, next } = response.data;
        setFoods(prev => customPage === 1 ? results : [...prev, ...results]);
        setTotalCount(count);
        setHasMore(!!next);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi tìm kiếm');
      if (isRefreshing) setFoods([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildSearchUrl]);

  // Khi vào trang, nếu có initialQuery thì tự động tìm kiếm
  useEffect(() => {
    if (initialQuery) {
      setIsSearched(true);
      fetchFoods(true, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load more khi cuộn cuối danh sách
  const loadMore = () => {
    if (!loading && hasMore && isSearched && foods.length > 0) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFoods(false, nextPage);
    }
  };

  // Làm mới danh sách
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchFoods(true, 1);
  }, [fetchFoods]);

  // Khi nhấn tìm kiếm
  const handleSearch = () => {
    setIsSearched(true);
    setPage(1);
    fetchFoods(true, 1);
  };

  // Đặt lại bộ lọc
  const resetFilters = () => {
    setCategory('');
    setMealTime('');
    setMinPrice('');
    setMaxPrice('');
    setOrdering('');
    setPage(1);
    setIsSearched(false);
    setFoods([]);
    setTotalCount(0);
    setError(null);
    setHasMore(false);
  };

  // Render filter section
  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
      <View style={styles.filterRow}>
        <Picker
          selectedValue={category}
          onValueChange={setCategory}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          mode="dropdown"
        >
          <Picker.Item label="Tất cả danh mục" value="" />
          <Picker.Item label="Món chính" value="main" />
          <Picker.Item label="Món phụ" value="side" />
          <Picker.Item label="Tráng miệng" value="dessert" />
        </Picker>

        <Picker
          selectedValue={mealTime}
          onValueChange={setMealTime}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          mode="dropdown"
        >
          <Picker.Item label="Tất cả thời gian" value="" />
          <Picker.Item label="Bữa sáng" value="breakfast" />
          <Picker.Item label="Bữa trưa" value="lunch" />
          <Picker.Item label="Bữa tối" value="dinner" />
        </Picker>

        <Picker
          selectedValue={ordering}
          onValueChange={setOrdering}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          mode="dropdown"
        >
          <Picker.Item label="Sắp xếp" value="" />
          <Picker.Item label="Giá tăng dần" value="price" />
          <Picker.Item label="Giá giảm dần" value="-price" />
          <Picker.Item label="Mới nhất" value="-created_date" />
        </Picker>

        <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Đặt lại</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // Render price filter
  const renderPriceFilter = () => (
    <View style={styles.priceFilterContainer}>
      <TextInput
        style={styles.priceInput}
        placeholder="Giá tối thiểu"
        keyboardType="numeric"
        value={minPrice}
        onChangeText={setMinPrice}
        placeholderTextColor="#aaa"
      />
      <Text style={styles.priceSeparator}>-</Text>
      <TextInput
        style={styles.priceInput}
        placeholder="Giá tối đa"
        keyboardType="numeric"
        value={maxPrice}
        onChangeText={setMaxPrice}
        placeholderTextColor="#aaa"
      />
    </View>
  );

  // Render food item
  const renderFoodItem = ({ item }) => (
    <FoodCard
      food={item}
      onPress={() => navigation.navigate('FoodDetail', { food: item })}
    />
  );

  // Render empty state
  const renderEmpty = () => {
    if (!isSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nhập từ khóa và nhấn tìm kiếm để bắt đầu
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {error ? error : 'Không tìm thấy món ăn phù hợp'}
        </Text>
      </View>
    );
  };

  // Render footer
  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm món ăn..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {renderFilters()}
      {renderPriceFilter()}

      {/* Results Count */}
      <Text style={styles.resultCount}>
        Tìm thấy {totalCount} kết quả
      </Text>

      {/* Food List */}
      <FlatList
        data={foods}
        renderItem={renderFoodItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 0,
    paddingBottom: 0,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
    fontSize: 16,
    color: '#222',
  },
  searchButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 0,
    borderBottomWidth: 0,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  picker: {
    width: 130,
    height: 50,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    justifyContent: 'center',
    marginVertical: 0,
    paddingVertical: 0,
  },
  pickerItem: {
    height: 38,
    fontSize: 15,
    textAlign: 'center',
  },
  resetButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginLeft: 10,
    height: 36,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  priceFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 0,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 0,
  },
  priceInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#222',
  },
  priceSeparator: {
    marginHorizontal: 8,
    color: '#666',
    fontSize: 18,
  },
  resultCount: {
    padding: 10,
    color: '#666',
    fontSize: 15,
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 0,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 15,
  },
  footer: {
    padding: 10,
    alignItems: 'center',
  },
});

export default SearchScreen; 