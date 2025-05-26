import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider, RadioButton, Chip, Card } from 'react-native-paper';
import { authApi, endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MyUserContext } from '../../configs/Contexts';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const OrderScreen = ({ route, navigation }) => {
  // Kiểm tra xem đang xem chi tiết đơn hàng đã đặt hay đang tạo đơn hàng mới
  const isExistingOrder = route.params.order !== undefined;
  const isFromCart = route.params.fromCart;
  
  // Lấy dữ liệu từ params
  const { order, foods = [] } = route.params;
  
  // State cho đơn hàng mới
  const [orderItems, setOrderItems] = useState(foods);
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [currentOrder, setCurrentOrder] = useState(order);
  
  // Context user
  const user = useContext(MyUserContext);

  // Lấy thông tin người dùng khi component mount
  useEffect(() => {
    if (user && !isExistingOrder) {
      setAddress(user.address || '');
      setPhoneNumber(user.phone || '');
    }
  }, [user]);

  // Tính tổng tiền đơn hàng
  const calculateTotal = () => {
    if (isExistingOrder) {
      return currentOrder.total_amount || 0;
    }
    
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Xử lý đặt hàng
  const handleCreateOrder = async () => {
    if (!user) {
      Alert.alert('Thông báo', 'Bạn cần đăng nhập để đặt hàng!');
      return;
    }

    try {
      // Lấy token từ AsyncStorage
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        return;
      }

      if (!address) {
        Alert.alert('Thông báo', 'Vui lòng nhập địa chỉ giao hàng!');
        return;
      }

      if (!phoneNumber) {
        Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại!');
        return;
      }

      if (orderItems.length === 0) {
        Alert.alert('Thông báo', 'Đơn hàng trống!');
        return;
      }

      // Kiểm tra xem tất cả các món có thuộc cùng một cửa hàng không
      const storeIds = new Set(orderItems.map(item => item.store_id).filter(id => id));
      if (storeIds.size > 1) {
        Alert.alert('Thông báo', 'Hiện tại chỉ có thể đặt món từ một cửa hàng trong một lần đặt hàng');
        return;
      }
      
      console.info(orderItems[0]?.store_id );
      // Lấy store_id từ món đầu tiên, hoặc dùng ID mặc định nếu không có
      const storeId = orderItems[0]?.store_id || 1;

      setCreatingOrder(true);

      // In thông tin các món để debug
      console.log("Order items:", JSON.stringify(orderItems, null, 2));

      // Tạo dữ liệu gửi lên server theo đúng cấu trúc server mong đợi
      console.log("storeId value before creating orderData:", storeId);
      const orderData = {
        delivery_address: address,
        store: storeId,
        payment_method: paymentMethod.toUpperCase(), // Đảm bảo đúng định dạng enum trong Django
        note: orderNote || "",
        items: orderItems.map(item => ({
          food: item.id,
          quantity: item.quantity
        }))
      };

      // Gọi API tạo đơn hàng
      const response = await authApi(token).post(endpoints['create-order'], orderData);

      console.log("Order created successfully:", response.data);

      // Nếu là đặt từ giỏ hàng, xóa giỏ hàng
      if (isFromCart) {
        await AsyncStorage.removeItem('cart');
      }

      // Thông báo thành công
      Alert.alert(
        'Thành công',
        'Đặt hàng thành công!',
        [
          { 
            text: 'Xem chi tiết', 
            onPress: () => {
              navigation.navigate('Trang chủ', {
                screen: 'Order',
                params: { order: response.data }
              });
            }
          }
        ]
      );

    } catch (err) {
      console.error('Create Order Error:', err);
      console.error('Response status:', err.response?.status);
      console.error('Response data:', err.response?.data);
      
      // In ra cụ thể hơn về cấu trúc lỗi
      if (err.response) {
        console.error('Error response headers:', err.response.headers);
        console.error('Error response config:', err.response.config);
      }
      
      let errorMessage = 'Không thể tạo đơn hàng. Vui lòng thử lại sau.';
      
      if (err.response && err.response.data) {
        // Hiển thị thông báo lỗi chi tiết từ server nếu có
        const errorData = err.response.data;
        if (typeof errorData === 'object') {
          errorMessage = Object.entries(errorData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setCreatingOrder(false);
    }
  };

  // Xử lý thanh toán cho đơn hàng đã tạo
  const handlePayment = async () => {
    if (!isExistingOrder) return;

    try {
      setLoading(true);
      
      if (paymentMethod === 'cash') {
        Alert.alert('Thông báo', 'Bạn sẽ thanh toán khi nhận hàng.');
        return;
      }

      // Nếu là thanh toán trực tuyến
      const response = await authApi(user.token).post(endpoints['update-order'](order.id), {
        payment_method: paymentMethod,
        status: 'processing_payment'
      });

      // Xử lý theo từng phương thức thanh toán
      if (['paypal', 'stripe', 'momo', 'zalopay'].includes(paymentMethod)) {
        // Trong môi trường thực tế, sẽ chuyển đến WebView hoặc tích hợp SDK thanh toán
        Alert.alert(
          'Chuyển hướng thanh toán',
          `Bạn sẽ được chuyển đến trang thanh toán ${paymentMethod.toUpperCase()}`,
          [
            { text: 'Hủy', style: 'cancel' },
            { 
              text: 'Tiếp tục', 
              onPress: () => {
                // Mô phỏng thanh toán thành công
                Alert.alert('Thành công', 'Thanh toán thành công!');
              } 
            }
          ]
        );
      }
    } catch (error) {
      console.error('Payment Error:', error);
      Alert.alert('Lỗi', 'Không thể xử lý thanh toán');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý xác nhận đơn hàng
  const handleConfirmOrder = async () => {
    if (!user || !currentOrder) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        return;
      }

      setLoading(true);
      await authApi(token).post(endpoints['confirm-order'](currentOrder.id));
      
      // Cập nhật trạng thái đơn hàng trong state
      setCurrentOrder({
        ...currentOrder,
        status: 'CONFIRMED'
      });
      
      Alert.alert('Thành công', 'Đã xác nhận đơn hàng');
    } catch (error) {
      console.error('Lỗi xác nhận đơn hàng:', error);
      Alert.alert('Lỗi', 'Không thể xác nhận đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý ghi nhận giao hàng
  const handleDeliverOrder = async () => {
    if (!user || !currentOrder) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        return;
      }

      setLoading(true);
      await authApi(token).post(endpoints['deliver-order'](currentOrder.id));
      
      // Cập nhật trạng thái đơn hàng trong state
      setCurrentOrder({
        ...currentOrder,
        status: 'DELIVERED'
      });
      
      Alert.alert('Thành công', 'Đã ghi nhận giao hàng');
    } catch (error) {
      console.error('Lỗi ghi nhận giao hàng:', error);
      Alert.alert('Lỗi', 'Không thể ghi nhận giao hàng');
    } finally {
      setLoading(false);
    }
  };

  // Hiển thị trạng thái đơn hàng
  const getStatusChip = (status) => {
    let color = '#666';
    let icon = 'clock';
    let label = 'Không xác định';
    
    switch (status) {
      case 'PENDING':
        color = '#FFA000';
        icon = 'clock-outline';
        label = 'Chờ xác nhận';
        break;
      case 'CONFIRMED':
        color = '#2196F3';
        icon = 'check-circle-outline';
        label = 'Đã xác nhận';
        break;
      case 'DELIVERED':
        color = '#4CAF50';
        icon = 'truck-check';
        label = 'Đã giao hàng';
        break;
      case 'CANCELLED':
        color = '#F44336';
        icon = 'close-circle-outline';
        label = 'Đã hủy';
        break;
    }

    return (
      <Chip
        icon={icon}
        style={[styles.statusChip, { backgroundColor: color }]}
        textStyle={{ color: '#fff' }}
      >
        {label}
      </Chip>
    );
  };

  // Render danh sách món ăn trong đơn
  const renderOrderItems = () => {
    const items = isExistingOrder ? (order.order_items || []) : orderItems;

    if (items.length === 0) {
      return (
        <Text style={styles.emptyText}>Không có món ăn nào</Text>
      );
    }

    return (
      <View>
        {items.map((item, index) => (
          <View key={index} style={styles.orderItem}>
            {!isExistingOrder && (
              <Image
                source={{ uri: item.image || 'https://via.placeholder.com/60' }}
                style={styles.foodImage}
              />
            )}
            <View style={styles.foodInfo}>
              <Text style={styles.foodName}>{item.name || item.food?.name}</Text>
              <Text style={styles.foodPrice}>
                {(item.price || item.unit_price)?.toLocaleString('vi-VN')}đ x {item.quantity}
              </Text>
              {item.note && (
                <Text style={styles.foodNote}>Ghi chú: {item.note}</Text>
              )}
            </View>
            <Text style={styles.foodTotal}>
              {((item.price || item.unit_price) * item.quantity).toLocaleString('vi-VN')}đ
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Render thông tin đơn hàng đã tạo
  const renderExistingOrder = () => {
    if (!currentOrder) return null;

    return (
      <ScrollView style={styles.container}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Đơn hàng #{currentOrder.id}</Text>
          {getStatusChip(currentOrder.status)}
        </View>

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
          <Text style={styles.infoText}>Người nhận: {currentOrder.customer_name}</Text>
          <Text style={styles.infoText}>Số điện thoại: {currentOrder.customer_phone}</Text>
          <Text style={styles.infoText}>Địa chỉ: {currentOrder.delivery_address}</Text>
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Chi tiết đơn hàng</Text>
          {currentOrder.items?.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <Text style={styles.itemName}>{item.food_name}</Text>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>
                {(item.price * item.quantity).toLocaleString('vi-VN')}đ
              </Text>
            </View>
          ))}
          
          <Divider style={styles.divider} />
          
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.totalAmount}>
              {calculateTotal().toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>

        {/* Hiển thị nút xác nhận và giao hàng cho chủ cửa hàng */}
        {user?.role === 'Chủ cửa hàng' && (
          <View style={styles.actionButtons}>
            {currentOrder.status === 'PENDING' && (
              <Button
                mode="contained"
                onPress={handleConfirmOrder}
                loading={loading}
                style={styles.actionButton}
              >
                Xác nhận đơn hàng
              </Button>
            )}
            
            {currentOrder.status === 'CONFIRMED' && (
              <Button
                mode="contained"
                onPress={handleDeliverOrder}
                loading={loading}
                style={styles.actionButton}
              >
                Ghi nhận giao hàng
              </Button>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  // Render form tạo đơn hàng mới
  const renderCreateOrderForm = () => {
    return (
      <ScrollView>
        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Các món đã chọn</Text>
          {renderOrderItems()}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
          
          <Text style={styles.inputLabel}>Địa chỉ giao hàng:</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Nhập địa chỉ giao hàng"
          />
          
          <Text style={styles.inputLabel}>Số điện thoại:</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Nhập số điện thoại"
            keyboardType="phone-pad"
          />
          
          <Text style={styles.inputLabel}>Ghi chú đơn hàng (tùy chọn):</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder="Ghi chú cho nhà hàng hoặc người giao hàng"
            multiline
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Phương thức giao hàng</Text>
          <RadioButton.Group
            onValueChange={value => setDeliveryMethod(value)}
            value={deliveryMethod}
          >
            <RadioButton.Item label="Giao hàng tận nơi" value="delivery" />
            <RadioButton.Item label="Tự đến lấy" value="pickup" />
          </RadioButton.Group>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          <RadioButton.Group
            onValueChange={value => setPaymentMethod(value)}
            value={paymentMethod}
          >
            <RadioButton.Item label="Tiền mặt khi nhận hàng" value="cash" />
            <RadioButton.Item label="PayPal" value="paypal" />
            <RadioButton.Item label="Momo" value="momo" />
            <RadioButton.Item label="ZaloPay" value="zalopay" />
          </RadioButton.Group>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.orderSection}>
          <Text style={styles.sectionTitle}>Tổng thanh toán</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền món ăn:</Text>
            <Text style={styles.totalValue}>{calculateTotal().toLocaleString('vi-VN')}đ</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Phí vận chuyển:</Text>
            <Text style={styles.totalValue}>0đ</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.grandTotal}>{calculateTotal().toLocaleString('vi-VN')}đ</Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleCreateOrder}
          style={styles.orderButton}
          loading={creatingOrder}
          disabled={creatingOrder}
        >
          {creatingOrder ? 'Đang xử lý...' : 'Đặt hàng'}
        </Button>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {isExistingOrder ? renderExistingOrder() : renderCreateOrderForm()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  orderSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  divider: {
    backgroundColor: '#eee',
  },
  // Styles cho items trong đơn hàng
  orderItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  foodImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
  },
  foodInfo: {
    flex: 1,
    marginLeft: 10,
  },
  foodName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  foodPrice: {
    fontSize: 14,
    color: '#666',
  },
  foodNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  foodTotal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  // Styles cho form tạo đơn hàng
  inputLabel: {
    fontSize: 14,
    marginBottom: 5,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  noteInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  // Styles cho thông tin đơn hàng đã tạo
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    flex: 2,
    fontSize: 14,
  },
  statusText: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // Styles cho thông tin thanh toán
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
  },
  grandTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  // Styles cho buttons
  orderButton: {
    margin: 15,
    marginBottom: 30,
    backgroundColor: '#2196F3',
  },
  payButton: {
    marginTop: 15,
    backgroundColor: '#2196F3',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusChip: {
    marginLeft: 8,
  },
  orderCard: {
    margin: 16,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  actionButtons: {
    padding: 16,
  },
  actionButton: {
    marginBottom: 8,
  },
});

export default OrderScreen;