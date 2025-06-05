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
  Dimensions,
  LogBox,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import api, { endpoints } from '../../configs/Apis';
import FoodCard from '../Food/FoodCard';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Bỏ qua cảnh báo cụ thể (KHÔNG KHUYẾN KHÍCH cho cảnh báo này)
LogBox.ignoreLogs(['Warning: Text strings must be rendered within a <Text> component.']);

// Hoặc bỏ qua tất cả cảnh báo (KHÔNG KHUYẾN KHÍCH)
// LogBox.ignoreAllLogs();

// Hàm helper để định dạng giá tiền sang VND
const formatPriceVND = (price) => {
    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber)) {
        return 'N/A';
    }
    // Loại bỏ phần thập phân nếu nó là .00
    const formattedPrice = priceNumber.toFixed(priceNumber % 1 === 0 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formattedPrice}₫`;
};

const SearchScreen = () => {
  const navigation = useNavigation();
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

  // Load Categories and Stores on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [categoriesResponse, storesResponse] = await Promise.all([
          api.get(endpoints.categories),
          api.get(endpoints.stores),
        ]);
        if (categoriesResponse.data && Array.isArray(categoriesResponse.data)) {
          setCategories(categoriesResponse.data);
        }
        if (storesResponse.data && Array.isArray(storesResponse.data)) {
          setStores(storesResponse.data);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Không thể tải dữ liệu ban đầu.'); // Set error for initial load
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Build the search URL based on state
  const buildSearchUrl = useCallback((customPage) => {
    const params = new URLSearchParams();

    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedStore) params.append('store_id', selectedStore);
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);

    // Thêm tham số page vào cuối
    params.append('page', customPage || page);

    return `${endpoints.foods}?${params.toString()}`;
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice, page]);

  // Fetch foods based on current filters and page
  const fetchFoods = useCallback(async (isNewSearch = false) => {
    if (isNewSearch) {
      setPage(1);
      setFoods([]);
      setHasMore(true);
      setError(null); // Clear previous errors on new search
    }

    // Prevent fetching if no more data or already loading (unless new search)
    if (!hasMore && !isNewSearch) return;
    if (loading && !isNewSearch) return; // Avoid duplicate calls while loading

    setLoading(true);
    try {
      const currentPageToFetch = isNewSearch ? 1 : page;
      const currentUrl = buildSearchUrl(currentPageToFetch);
      console.log('Fetching:', currentUrl);
      const response = await api.get(currentUrl);

      if (response.data && Array.isArray(response.data.results)) {
        const newFoods = response.data.results;

        setFoods(prevFoods => {
            if (isNewSearch) {
                return newFoods;
            } else {
                // Lọc bỏ các món trùng lặp nếu có (dựa vào id)
                const existingFoodIds = new Set(prevFoods.map(food => food.id));
                const uniqueNewFoods = newFoods.filter(food => !existingFoodIds.has(food.id));
                return [...prevFoods, ...uniqueNewFoods];
            }
        });

        setTotalCount(response.data.count);
        setHasMore(!!response.data.next);
        if (!isNewSearch && response.data.next) { // Chỉ tăng page nếu có trang tiếp theo
             setPage(prevPage => prevPage + 1);
        }
      } else { // Handle non-paginated response or empty results (shouldn't happen with paginator)
         // Nếu API trả về mảng rỗng hoặc định dạng không mong muốn khi có kết quả 0
         if (isNewSearch) {
             setFoods([]);
             setTotalCount(0);
             setHasMore(false);
         } // else: Nếu loadmore mà không có kết quả, hasMore sẽ tự false ở check response.data.next
      }

    } catch (err) {
      console.error('Search error:', err.response?.status, err.response?.data || err.message);
      setError(err.response?.data?.detail || 'Có lỗi xảy ra khi tìm kiếm');
      setHasMore(false); // Dừng load more khi có lỗi
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice, page, buildSearchUrl, hasMore, loading]); // Thêm loading vào dependencies

  // Trigger search when filters change (with debounce)
  useEffect(() => {
    if (initialLoading) return; // Bỏ qua lần chạy đầu tiên khi initialLoading còn true

    const handler = setTimeout(() => {
       console.log('Filters changed, triggering new search...');
       handleSearch(); // Trigger a new search (page 1)
    }, 500); // Debounce time: 500ms after the last change

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, selectedCategory, selectedStore, minPrice, maxPrice, initialLoading]);

  // Initial load when component mounts (after initial data is loaded)
   useEffect(() => {
       if (!initialLoading) {
           console.log('Initial data loaded, triggering first search...');
           handleSearch(); // Trigger initial search after categories/stores loaded
       }
   }, [initialLoading]); // Phụ thuộc vào initialLoading

  const handleSearch = () => {
     setError(null);
     setFoods([]); // Clear previous results immediately on new search
     setPage(1);
     setHasMore(true);
     fetchFoods(true); // Pass true for new search
  };

  const loadMore = () => {
    if (!loading && hasMore) {
        console.log('Loading more foods...');
        fetchFoods(false); // Pass false for load more
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedCategory('');
    setSelectedStore('');
    // handleSearch() sẽ được gọi tự động qua useEffect khi state filter thay đổi
  };

  // Render footer based on loading state and hasMore
   const renderFooter = () => {
      // Không hiển thị footer nếu đang tải lần đầu hoặc có lỗi
      if (initialLoading || error) return null;
      // Hiển thị loading indicator chỉ khi đang tải thêm (không phải tải lần đầu) VÀ còn dữ liệu để tải
      if (loading && hasMore) {
           return (
              <View style={styles.footerLoadingContainer}>
                <ActivityIndicator size="small" color="#0000ff" />
              </View>
           );
      }
      // Không hiển thị footer nếu không còn gì để tải và đã tải xong
      return null;
    };

  // Handle empty or error states
  const renderEmptyComponent = () => {
    if (loading || initialLoading || error) {
        return null; // Đảm bảo trả về null hoặc component
    }

    // Nếu không loading, không lỗi, không initial loading và danh sách foods rỗng
    if (foods.length === 0) {
        return (
             <View style={styles.emptyResultsContainer}>
                <Text style={styles.emptyResultsText}>Không tìm thấy món ăn phù hợp với bộ lọc.</Text>
             </View>
        );
    }
    return null; // Trả về null nếu có dữ liệu
  };


  // Render main content
  if (initialLoading) {
     return (
        <View style={styles.centeredContainer}>
           <ActivityIndicator size="large" color="#0000ff" />
           <Text style={styles.loadingText}>Đang tải dữ liệu ban đầu...</Text>
        </View>
     );
  }

  if (error && !loading) { // Show error only when not loading
       return (
          <View style={styles.centeredContainer}>
              <Ionicons name="alert-circle-outline" size={50} color="#c0392b" />
              <Text style={styles.errorText}>Lỗi: {error}</Text>
               <TouchableOpacity onPress={handleSearch} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Thử lại</Text>
               </TouchableOpacity>
          </View>
       );
  }

  // Chỉ render phần chính khi không initial loading và không có lỗi toàn màn hình
  return (
    <View style={styles.mainContainer}> {/* Container chính với flex: 1 và column */}
      {/* Thanh tìm kiếm */}
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

      {/* Thanh bộ lọc - Bọc trong View để dễ quản lý layout nếu cần */}
      <View> 
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filtersScrollViewContent}
            style={styles.filtersScrollView} // Style cho chính ScrollView component
          > 
            <View style={styles.filtersRow}> {/* Row chứa các filter */} 
               {/* Filter Loại thức ăn */}
               <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedCategory}
                  onValueChange={(itemValue) => setSelectedCategory(itemValue)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Loại thức ăn" value="" />
                  {categories.map(cat => (
                    <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
                  ))}
                </Picker>
              </View>

               {/* Filter Cửa hàng */}
               <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedStore}
                    onValueChange={(itemValue) => setSelectedStore(itemValue)}
                    style={styles.picker}
                     itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="Cửa hàng" value="" />
                     {stores.map(store => (
                      <Picker.Item key={store.id} label={store.name} value={store.id} />
                    ))}
                  </Picker>
                </View>

               {/* Filter Giá */}
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

                {/* Nút Đặt lại */} 
                <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
                    <Text style={styles.resetButtonText}>Đặt lại</Text>
                </TouchableOpacity>
            </View>
          </ScrollView>
      </View>

      {/* Hiển thị số lượng kết quả (chỉ khi có kết quả và không phải đang tải lần đầu hoặc có lỗi) */}
      {totalCount > 0 && !initialLoading && !error && (
         <Text style={styles.resultCountText}>Tìm thấy {totalCount} kết quả</Text>
      )}

      {/* Danh sách món ăn (FlatList) */}
       {/* Sử dụng flex: 1 để FlatList chiếm hết không gian còn lại */}
       {/* renderEmptyComponent sẽ tự động hiển thị khi data rỗng và không loading/error */} 
      <FlatList
        data={foods}
        renderItem={({ item }) => (
          <FoodCard
            food={item}
            onPress={() => navigation.navigate('DishDetail', { 
              id: item.id,
              name: item.name
            })} 
          />
        )}
        keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : index.toString()} 
        contentContainerStyle={styles.resultsListContent} 
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter} 
        ListEmptyComponent={renderEmptyComponent()} // Gọi hàm để nhận component
        style={styles.foodList} // Style cho chính FlatList component
      />

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { // Container chính với flex: 1 và column
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 0, // Đảm bảo không có padding top mặc định
  },
  centeredContainer: { // Container cho loading/error toàn màn hình
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 20,
  },
  searchBarContainer: { // Thanh tìm kiếm
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
    // Không cần margin/padding bottom lớn ở đây
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
   filtersScrollView: { // Style cho chính ScrollView component
       // Kiểm soát khoảng cách với phần tử trên/dưới
       // Không cần margin/padding vertical lớn
       marginBottom: 0,
       paddingVertical: 0,
   },
  filtersScrollViewContent: { // contentContainerStyle cho ScrollView
     paddingHorizontal: 10,
     paddingVertical: 8, // Padding bên trong ScrollView items
     alignItems: 'center', 
  },
  filtersRow: { // View bên trong ScrollView chứa các filter
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerContainer: { 
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    height: 55,
    paddingVertical: 0, 
    width: 200,
  },
   picker: { 
    height: 55,
    width: 200,
  },
  pickerItem: { 
      fontSize: 14,
      height: 55, 
  },
  priceFilterContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    marginRight: 10,
    height: 55,
    width: 200,
  },
  priceInput: {
    width: 80,
    textAlign: 'center',
    paddingVertical: 0, 
    height: 55,
  },
  priceSeparator: {
    marginHorizontal: 5,
    fontSize: 16,
    color: '#666',
  },
  resetButton: {
     paddingVertical: 8,
     paddingHorizontal: 15,
     backgroundColor: '#DC3545',
     borderRadius: 20,
  },
  resetButtonText: {
      color: '#fff',
      fontWeight: 'bold',
  },
  resultCountText: { // Text hiển thị số lượng kết quả
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0', 
    // Đảm bảo không có margin top/bottom lớn ở đây
    marginTop: 0,
    marginBottom: 0,
  },
  foodList: { // Style cho chính FlatList component
    flex: 1, // Rất quan trọng: giúp FlatList lấp đầy không gian còn lại
    // Không nên đặt padding/margin vertical lớn ở đây
    marginTop: 0,
  },
  resultsListContent: { // contentContainerStyle cho FlatList
    paddingHorizontal: 10,
    paddingTop: 0, // Đảm bảo không có padding top lớn
    paddingBottom: 20, // Padding dưới cùng để tránh item cuối bị cắt
    // flexGrow: 1, // Không cần thiết nếu FlatList đã có flex: 1 và container cha có flex
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    textAlign: 'center',
  },
   footerLoadingContainer: { 
      paddingVertical: 20,
      borderTopWidth: 1,
      borderColor: '#ced0ce',
      alignItems: 'center',
   },
  emptyResultsContainer: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Không nên có marginTop lớn ở đây nếu FlatList có flex: 1
    // marginTop: 50,
    padding: 20,
  },
  emptyResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
   errorText: {
      fontSize: 16,
      color: '#c0392b',
      textAlign: 'center',
      marginVertical: 20,
   },
   retryButton: {
       marginTop: 10,
       backgroundColor: '#3498db',
       paddingVertical: 10,
       paddingHorizontal: 20,
       borderRadius: 5,
   },
   retryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
   }
});

export default SearchScreen;
