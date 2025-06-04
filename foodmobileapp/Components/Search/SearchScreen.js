import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import api, { endpoints } from '../../configs/Apis';
import FoodCard from '../Food/FoodCard';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);

  const loadCategories = async () => {
    try {
      const response = await api.get(endpoints.categories);
      if (response.data && Array.isArray(response.data)) {
        setCategories(response.data);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadStores = async () => {
    try {
      const response = await api.get(endpoints.stores);
       if (response.data && Array.isArray(response.data)) {
        setStores(response.data);
      }
    } catch (err) {
      console.error('Error loading stores:', err);
    }
  };

  useEffect(() => {
    setInitialLoading(true);
    loadCategories();
    loadStores();
    setInitialLoading(false);
  }, []);

  const buildSearchUrl = useCallback((customPage) => {
    let url = `${endpoints.foods}?page=${customPage || page}`;
    const params = new URLSearchParams();

    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory) params.append('category_id', selectedCategory);
    if (selectedStore) params.append('store_id', selectedStore);
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);

    return `${endpoints.foods}?${params.toString()}${customPage ? `&page=${customPage}` : `&page=${page}`}`;
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice, page]);

  const fetchFoods = useCallback(async (isNewSearch = false) => {
    if (isNewSearch) {
      setPage(1);
      setFoods([]);
      setHasMore(true);
      setError(null);
    }

    if (!hasMore && !isNewSearch) return;

    setLoading(true);
    try {
      const currentUrl = buildSearchUrl(isNewSearch ? 1 : page);
      console.log('Fetching:', currentUrl);
      const response = await api.get(currentUrl);

      if (response.data && Array.isArray(response.data.results)) {
        const newFoods = response.data.results;
        setFoods(prevFoods => isNewSearch ? newFoods : [...prevFoods, ...newFoods]);
        setTotalCount(response.data.count);
        setHasMore(!!response.data.next);
        if (!isNewSearch) setPage(prevPage => prevPage + 1);
      } else if (response.data && Array.isArray(response.data)) {
           const newFoods = response.data;
           setFoods(isNewSearch ? newFoods : [...foods, ...newFoods]);
           setTotalCount(newFoods.length);
           setHasMore(false);
            if (!isNewSearch && newFoods.length > 0) setPage(prevPage => prevPage + 1);
      } else {
         setFoods(isNewSearch ? [] : foods);
         setTotalCount(0);
         setHasMore(false);
      }

    } catch (err) {
      console.error('Search error:', err.response?.status, err.response?.data || err.message);
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi tìm kiếm');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice, page, buildSearchUrl, hasMore, foods]);

  const handleSearch = () => {
     setError(null);
     fetchFoods(true);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
        fetchFoods(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedCategory('');
    setSelectedStore('');
    setFoods([]);
    setTotalCount(0);
    setPage(1);
    setHasMore(true);
    setError(null);
  };

  useEffect(() => {
      const handler = setTimeout(() => {
        if (!initialLoading) {
           handleSearch();
        }
      }, 500);

      return () => {
        clearTimeout(handler);
      };
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice]);

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScrollView}>
        <View style={styles.filtersRow}>
           <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCategory}
              onValueChange={(itemValue) => setSelectedCategory(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Loại thức ăn" value="" />
              {categories.map(cat => (
                <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
              ))}
            </Picker>
          </View>

           <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedStore}
                onValueChange={(itemValue) => setSelectedStore(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Cửa hàng" value="" />
                 {stores.map(store => (
                  <Picker.Item key={store.id} label={store.name} value={store.id} />
                ))}
              </Picker>
            </View>
            
           <View style={styles.priceFilterContainer}>
              <TextInput
                style={styles.priceInput}
                placeholder="Giá từ"
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
              />
              <Text style={styles.priceSeparator}>-</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Giá đến"
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>

            <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Đặt lại</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>

      {totalCount > 0 && (
         <Text style={styles.resultCountText}>Tìm thấy {totalCount} kết quả</Text>
      )}

      {initialLoading ? (
         <ActivityIndicator style={styles.loadingIndicator} size="large" color="#0000ff" />
      ) : error ? (
         <View style={styles.emptyResultsContainer}>
              <Text style={styles.emptyResultsText}>Lỗi: {error}</Text>
         </View>
      ) : (
        <FlatList
          data={foods}
          renderItem={({ item }) => <FoodCard food={item} onPress={() => console.log('Navigate to food detail', item.id)} />}
          keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : index.toString()}
          contentContainerStyle={styles.resultsList}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
             !loading && !error && (
              <View style={styles.emptyResultsContainer}>
                <Text style={styles.emptyResultsText}>Không tìm thấy món ăn phù hợp.</Text>
              </View>
             )
          }
           ListFooterComponent={
              loading && <ActivityIndicator style={styles.footerLoading} size="small" color="#0000ff" />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 0,
  },
  searchBarContainer: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchButton: {
    padding: 8,
  },
  filtersScrollView: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerContainer: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    minWidth: 120,
    height: 50,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  priceFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    marginRight: 10,
    height: 40,
  },
  priceInput: {
    width: 60,
    textAlign: 'center',
  },
  priceSeparator: {
    marginHorizontal: 5,
    fontSize: 16,
    color: '#666',
  },
  filterButton: {
    padding: 8,
    backgroundColor: '#007BFF',
    borderRadius: 20,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resetButton: {
     padding: 8,
     backgroundColor: '#DC3545',
     borderRadius: 20,
  },
  resetButtonText: {
      color: '#fff',
      fontWeight: 'bold',
  },
  resultCountText: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 14,
    color: '#666',
  },
  resultsList: {
    flexGrow: 1,
    paddingHorizontal: 10,
  },
  resultItem: {
    padding: 10,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultItemPrice: {
    fontSize: 14,
    color: 'green',
  },
  resultItemInfo: {
    fontSize: 12,
    color: '#666',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  footerLoading: {
     paddingVertical: 10,
  },
  emptyResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
  },
});

export default SearchScreen; 