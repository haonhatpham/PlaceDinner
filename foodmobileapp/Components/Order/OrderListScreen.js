import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  StyleSheet,
  Image
} from 'react-native';
import { Divider, Button, Badge, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, endpoints } from '../../configs/Apis';
import { MyUserContext } from '../../configs/Contexts';
import { useFocusEffect } from '@react-navigation/native';

const OrderListScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  console.log(orders);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(true);
  const user = useContext(MyUserContext);

  // Lấy giỏ hàng từ AsyncStorage
  const fetchCart = async () => {
    try {
      setCartLoading(true);
      const cartString = await AsyncStorage.getItem('cart');
      if (cartString) {
        const cart = JSON.parse(cartString);
        setCartItems(cart);
      } else {
        setCartItems([]);
      }
    } catch (err) {
      console.error('Error loading cart:', err);
    } finally {
      setCartLoading(false);
    }
  };

  // Lấy lịch sử đơn hàng
  const fetchOrders = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!user || !token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await authApi(token).get(endpoints['user-orders']);
      setOrders(res.data);
    } catch (err) {
      console.error('Error loading orders:', err);
      if (err.response && err.response.status === 401) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
      }
    } finally {
      setLoading(false);
    }
  };

  // Cập nhật số lượng món trong giỏ
  const updateQuantity = async (itemId, newQuantity) => {
    try {
      if (newQuantity <= 0) {
        // Nếu số lượng = 0, xóa khỏi giỏ
        removeItem(itemId);
        return;
      }

      const updatedCart = cartItems.map(item => 
        item.id === itemId ? {...item, quantity: newQuantity} : item
      );

      setCartItems(updatedCart);
      await AsyncStorage.setItem('cart', JSON.stringify(updatedCart));
    } catch (err) {
      console.error('Error updating quantity:', err);
      Alert.alert('Lỗi', 'Không thể cập nhật số lượng');
    }
  };

  // Xóa món khỏi giỏ
  const removeItem = async (itemId) => {
    try {
      const updatedCart = cartItems.filter(item => item.id !== itemId);
      setCartItems(updatedCart);
      await AsyncStorage.setItem('cart', JSON.stringify(updatedCart));
    } catch (err) {
      console.error('Error removing item:', err);
      Alert.alert('Lỗi', 'Không thể xóa món ăn khỏi giỏ');
    }
  };

  // Xóa toàn bộ giỏ hàng
  const clearCart = async () => {
    try {
      await AsyncStorage.removeItem('cart');
      setCartItems([]);
    } catch (err) {
      console.error('Error clearing cart:', err);
      Alert.alert('Lỗi', 'Không thể xóa giỏ hàng');
    }
  };

  // Chuyển đến màn hình đặt hàng với tất cả món trong giỏ
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Thông báo', 'Giỏ hàng của bạn đang trống');
      return;
    }

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

    // Kiểm tra xem giỏ hàng có món từ nhiều cửa hàng khác nhau không
    const storeIds = new Set(cartItems.map(item => item.store_id).filter(id => id));
    if (storeIds.size > 1) {
      Alert.alert(
        'Thông báo',
        'Hiện tại bạn chỉ có thể đặt món từ một cửa hàng trong một lần đặt hàng',
        [
          { text: 'Đóng', style: 'cancel' }
        ]
      );
      return;
    }

    // Điều hướng đến màn hình Order trong TabNavigator Trang chủ
    navigation.navigate('Trang chủ', {
      screen: 'Order',
      params: {
        foods: cartItems,
        fromCart: true
      }
    });
  };

  // Làm mới dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      fetchCart();
      fetchOrders();
    }, [user])
  );

  // Tính tổng tiền giỏ hàng
  const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Render giỏ hàng
  const renderCartSection = () => {
    if (cartLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0000ff" />
          <Text>Đang tải giỏ hàng...</Text>
        </View>
      );
    }

    if (cartItems.length === 0) {
      return (
        <View style={styles.emptyCartContainer}>
          <Text style={styles.emptyCartText}>Giỏ hàng trống</Text>
          <Button 
            mode="contained" 
            onPress={() => navigation.navigate('Trang chủ')}
            style={styles.shopButton}
          >
            Mua sắm ngay
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.cartContainer}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>Giỏ hàng của bạn</Text>
          <Button 
            mode="text" 
            onPress={() => {
              Alert.alert(
                'Xác nhận',
                'Bạn có chắc muốn xóa toàn bộ giỏ hàng?',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Xóa', onPress: clearCart, style: 'destructive' }
                ]
              )
            }}
          >
            Xóa tất cả
          </Button>
        </View>
        
        <FlatList
          data={cartItems}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <Image 
                source={{ uri: item.image || 'https://via.placeholder.com/100' }} 
                style={styles.cartItemImage} 
              />
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <Text style={styles.cartItemPrice}>{item.price?.toLocaleString('vi-VN')}đ</Text>
                {item.store_name && (
                  <Text style={styles.cartItemStore}>{item.store_name}</Text>
                )}
              </View>
              <View style={styles.cartItemActions}>
                <IconButton
                  icon="minus"
                  size={20}
                  onPress={() => updateQuantity(item.id, item.quantity - 1)}
                />
                <Text style={styles.cartItemQuantity}>{item.quantity}</Text>
                <IconButton
                  icon="plus"
                  size={20}
                  onPress={() => updateQuantity(item.id, item.quantity + 1)}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  onPress={() => {
                    Alert.alert(
                      'Xác nhận',
                      `Xóa ${item.name} khỏi giỏ hàng?`,
                      [
                        { text: 'Hủy', style: 'cancel' },
                        { text: 'Xóa', onPress: () => removeItem(item.id) }
                      ]
                    )
                  }}
                />
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <Divider />}
        />

        <View style={styles.cartFooter}>
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>Tổng cộng:</Text>
            <Text style={styles.cartTotalAmount}>{totalAmount.toLocaleString('vi-VN')}đ</Text>
          </View>
          <Button 
            mode="contained" 
            onPress={handleCheckout}
            style={styles.checkoutButton}
          >
            Đặt hàng
          </Button>
        </View>
      </View>
    );
  };

  // Render lịch sử đơn hàng
  const renderOrdersSection = () => {
    if (!user) {
      return (
        <View style={styles.loginPrompt}>
          <Text style={styles.loginPromptText}>Vui lòng đăng nhập để xem lịch sử đơn hàng</Text>
          <Button 
            mode="contained" 
            onPress={() => navigation.navigate('Đăng nhập')}
            style={styles.loginButton}
          >
            Đăng nhập
          </Button>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0000ff" />
          <Text>Đang tải đơn hàng...</Text>
        </View>
      );
    }

    return (
      <View style={styles.ordersContainer}>
        <Text style={styles.ordersTitle}>Lịch sử đơn hàng</Text>
        
        {orders.length === 0 ? (
          <Text style={styles.emptyOrdersText}>Bạn chưa có đơn hàng nào</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.orderItem}
                onPress={() => navigation.navigate('Trang chủ', {
                  screen: 'Order',
                  params: { order: item }
                })}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>Đơn hàng #{item.id}</Text>
                  <Badge>{item.status}</Badge>
                </View>
                <Text style={styles.orderDate}>Ngày đặt: {new Date(item.created_date).toLocaleDateString('vi-VN')}</Text>
                <Text style={styles.orderTotal}>Tổng tiền: {item.total_amount?.toLocaleString('vi-VN')}đ</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <Divider />}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderCartSection()}
      <Divider style={styles.sectionDivider} />
      {renderOrdersSection()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  // Cart styles
  cartContainer: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    maxHeight: 400,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  cartItemStore: {
    fontSize: 12,
    color: '#777',
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  cartFooter: {
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cartTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  checkoutButton: {
    backgroundColor: '#2196F3',
  },
  emptyCartContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#666',
  },
  shopButton: {
    marginTop: 10,
    backgroundColor: '#2196F3',
  },
  // Orders styles
  sectionDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  ordersContainer: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    flex: 1,
  },
  ordersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  orderItem: {
    padding: 15,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderDate: {
    fontSize: 14,
    color: '#777',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 5,
  },
  emptyOrdersText: {
    padding: 20,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  loginPrompt: {
    padding: 20,
    alignItems: 'center',
  },
  loginPromptText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 10,
    backgroundColor: '#2196F3',
  },
});

export default OrderListScreen; 