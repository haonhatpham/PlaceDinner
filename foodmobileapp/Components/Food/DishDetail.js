import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ToastAndroid
} from 'react-native';
import { Card, Button, IconButton, Badge, RadioButton, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { endpoints } from '../../configs/Apis';
import { MyUserContext } from '../../configs/Contexts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewSection from './ReviewSection';

const DishDetail = ({ route, navigation }) => {
  // Kiểm tra và lấy params
  if (!route || !route.params || !route.params.id) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={60} color="#c62828" />
        <Text style={styles.errorText}>Không tìm thấy thông tin món ăn</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.goBack()}
          style={styles.errorButton}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  const { id, name } = route.params;
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const user = useContext(MyUserContext);

  // Lấy thông tin món ăn từ API
  const loadFoodDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(endpoints.food_detail(id));
      setFood(response.data);
    } catch (err) {
      console.error('Food Detail Error:', err);
      setError('Không thể tải thông tin món ăn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFoodDetail();
  }, [id]);

  // Tăng số lượng
  const increaseQuantity = () => {
    setQuantity(quantity + 1);
  };

  // Giảm số lượng nhưng không dưới 1
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  // Xử lý thêm món ăn vào giỏ hàng (lưu ở local)
  const handleAddToCart = async () => {
    if (!user) {
      // Thông báo đăng nhập nếu chưa đăng nhập
      Alert.alert(
        'Thông báo',
        'Vui lòng đăng nhập để thêm món ăn vào giỏ hàng',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Đăng nhập') }
        ]
      );
      return;
    }

    try {
      // Lấy giỏ hàng hiện tại từ AsyncStorage
      const cartString = await AsyncStorage.getItem('cart');
      let cart = cartString ? JSON.parse(cartString) : [];
      
      // Kiểm tra xem món ăn đã có trong giỏ hàng chưa
      const existingItemIndex = cart.findIndex(item => item.id === food.id);
      
      if (existingItemIndex !== -1) {
        // Nếu đã có, cập nhật số lượng
        cart[existingItemIndex].quantity += quantity;
        cart[existingItemIndex].note = note || cart[existingItemIndex].note;
      } else {
        // Nếu chưa có, thêm mới
        cart.push({
          id: food.id,
          name: food.name,
          price: food.price,
          quantity: quantity,
          note: note,
          image: food.image,
          store_id: food.store,
        });
      }
      
      // Lưu giỏ hàng vào AsyncStorage
      await AsyncStorage.setItem('cart', JSON.stringify(cart));
      
      ToastAndroid.show('Đã thêm món ăn vào giỏ hàng', ToastAndroid.SHORT);
      
      // Hỏi người dùng có muốn xem giỏ hàng không
      Alert.alert(
        'Thành công',
        'Đã thêm món ăn vào giỏ hàng',
        [
          { text: 'Tiếp tục mua hàng', style: 'cancel' },
          { text: 'Xem giỏ hàng', onPress: () => navigation.navigate('Đơn hàng') }
        ]
      );
    } catch (err) {
      console.error('Add to Cart Error:', err);
      Alert.alert('Lỗi', 'Không thể thêm món ăn vào giỏ hàng');
    }
  };

  // Xử lý đặt món ngay
  const handleOrderNow = async () => {
    if (!user) {
      // Thông báo đăng nhập nếu chưa đăng nhập
      Alert.alert(
        'Thông báo',
        'Vui lòng đăng nhập để đặt món',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Đăng nhập', onPress: () => navigation.navigate('Đăng nhập') }
        ]
      );
      return;
    }

    try {
      // Lấy token từ AsyncStorage
      const token = await AsyncStorage.getItem('token');
      
      // Kiểm tra tình trạng tài khoản
      if (!token) {
        // Yêu cầu đăng nhập nếu không có token
        Alert.alert(
          'Phiên đăng nhập hết hạn',
          'Vui lòng đăng nhập lại để tiếp tục',
          [
            { text: 'Đồng ý', onPress: () => navigation.navigate('Đăng nhập') }
          ]
        );
        return;
      }

      // Chuyển đến màn hình đặt hàng với thông tin món ăn
      navigation.navigate('Order', {
        foods: [{
          id: food.id,
          name: food.name,
          price: food.price,
          quantity: quantity,
          note: note,
          image: food.image,
          store_id: food.store,
          store_name: ""
        }],
        directOrder: true // Đánh dấu là đặt hàng trực tiếp
      });
    } catch (err) {
      console.error('Order Now Error:', err);
      Alert.alert('Lỗi', 'Không thể tạo đơn hàng');
    }
  };

  const handleReviewAdded = () => {
    // Tải lại thông tin món ăn để cập nhật rating
    loadFoodDetail();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Đang tải thông tin món ăn...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={60} color="#c62828" />
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.goBack()}
          style={styles.errorButton}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="food-off" size={60} color="#c62828" />
        <Text style={styles.errorText}>Không tìm thấy thông tin món ăn</Text>
        <Button 
          mode="contained" 
          onPress={() => navigation.goBack()}
          style={styles.errorButton}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Ảnh món ăn */}
        <Image 
          source={{ uri: food.image || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-food.png' }} 
          style={styles.foodImage} 
        />

        {/* Thông tin chính của món ăn */}
        <View style={styles.mainInfoContainer}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.foodPrice}>{food.price?.toLocaleString('vi-VN')}đ</Text>
          
          {food.average_rating && (
            <View style={styles.ratingContainer}>
              <Icon name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingText}>{food.average_rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({food.review_count || 0} đánh giá)</Text>
            </View>
          )}
        </View>

        {/* Thông tin cửa hàng */}
        {food.store && (
          <TouchableOpacity 
            style={styles.storeContainer}
            onPress={() => navigation.navigate('StoreDetail', { 
              id: food.store.id,
              name: food.store.name
            })}
          >
            <Icon name="store" size={24} color="#555" />
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{food.store.name}</Text>
              <Text style={styles.storeAddress} numberOfLines={2}>{food.store.address}</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
        )}

        {/* Mô tả món ăn */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.description}>{food.description || 'Không có mô tả'}</Text>
          </Card.Content>
        </Card>

        {/* Chọn số lượng */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Số lượng</Text>
            <View style={styles.quantityContainer}>
              <IconButton
                icon="minus"
                size={20}
                onPress={decreaseQuantity}
                disabled={quantity <= 1}
                style={styles.quantityButton}
              />
              <Text style={styles.quantityText}>{quantity}</Text>
              <IconButton
                icon="plus"
                size={20}
                onPress={increaseQuantity}
                style={styles.quantityButton}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Ghi chú cho món ăn */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Ghi chú</Text>
            <TextInput
              mode="outlined"
              placeholder="Thêm ghi chú cho món ăn (không bắt buộc)"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              style={styles.noteInput}
            />
          </Card.Content>
        </Card>

        {/* Thành tiền */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Thành tiền:</Text>
              <Text style={styles.totalPrice}>{(food.price * quantity).toLocaleString('vi-VN')}đ</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Thêm phần đánh giá và bình luận */}
        <ReviewSection 
          foodId={id} 
          onReviewAdded={handleReviewAdded}
        />
      </ScrollView>

      {/* Bottom Bar với nút đặt hàng */}
      <View style={styles.bottomBar}>
        <Button
          mode="outlined"
          onPress={handleAddToCart}
          icon="cart"
          style={styles.cartButton}
          labelStyle={styles.buttonLabel}
        >
          Thêm vào giỏ
        </Button>
        <Button
          mode="contained"
          onPress={handleOrderNow}
          icon="food"
          style={styles.orderButton}
          labelStyle={styles.buttonLabel}
        >
          Đặt ngay
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  foodImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  mainInfoContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  foodName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  foodPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
    marginRight: 5,
  },
  reviewCount: {
    fontSize: 14,
    color: '#777',
  },
  storeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    marginTop: 10,
    marginBottom: 10,
  },
  storeInfo: {
    flex: 1,
    marginLeft: 10,
  },
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  storeAddress: {
    fontSize: 14,
    color: '#777',
  },
  sectionCard: {
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    backgroundColor: '#f0f0f0',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 15,
  },
  noteInput: {
    backgroundColor: '#fff',
  },
  totalCard: {
    marginHorizontal: 10,
    marginTop: 5,
    marginBottom: 80, // Để có không gian cho bottom bar
    borderRadius: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
  },
  cartButton: {
    flex: 1,
    marginRight: 10,
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  orderButton: {
    flex: 1,
    backgroundColor: '#2196F3',
  },
  buttonLabel: {
    fontWeight: 'bold',
    fontSize: 14,
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
    fontSize: 16,
    color: '#c62828',
    textAlign: 'center',
    marginVertical: 20,
  },
  errorButton: {
    marginTop: 10,
    backgroundColor: '#2196F3',
  },
});

export default DishDetail; 