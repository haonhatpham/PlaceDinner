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
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Divider, RadioButton, Chip, Card } from 'react-native-paper';
import { authApi, endpoints, BASE_URL } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MyUserContext } from '../../configs/Contexts';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg';

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
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  
  // Context user
  const user = useContext(MyUserContext);

  // Lấy thông tin người dùng khi component mount
  useEffect(() => {
    if (user && !isExistingOrder) {
      setAddress(user.address || '');
      setPhoneNumber(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    const handleDeepLink = (event) => {
      // Xử lý event.url ở đây
    };
    
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Return cleanup function
    return () => {
      subscription.remove();
    };
  }, []);

  // Tính tổng tiền đơn hàng
  const calculateTotal = () => {
    if (isExistingOrder) {
      return currentOrder.total_amount || 0;
    }
    
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Hàm xử lý thanh toán MoMo
  const handleMoMoPayment = async () => {
    try {
      setLoading(true);
      
      // Tạo đơn hàng trước
      const orderResponse = await handleCreateOrder();
      if (!orderResponse) return;

      // Gọi API tạo payment MoMo
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        return;
      }

      const redirectUrl = "placedinner://payment";
      // Tạo orderId duy nhất bằng cách thêm timestamp
      const timestamp = new Date().getTime();
      const orderId = `${orderResponse.data.id}_${timestamp}`;
      // Đảm bảo amount là số nguyên và tối thiểu là 10000
      const amount = Math.max(10000, Math.round(parseFloat(orderResponse.data.total_amount))).toString();
      
      console.log("Creating MoMo payment for order:", orderId);
      console.log("Order amount:", amount);
      
      const paymentData = {
        amount: amount,
        order_info: `Thanh toan don hang ${orderResponse.data.id}`,
        redirect_url: redirectUrl,
        ipn_url: `${BASE_URL}/momo/webhook/`,
        orderId: orderId
      };

      console.log("Payment data:", JSON.stringify(paymentData, null, 2));

      const paymentResponse = await authApi(token).post(
        endpoints['create-payment'],
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log("MoMo payment response:", JSON.stringify(paymentResponse.data, null, 2));

      if (paymentResponse.data && (paymentResponse.data.payUrl || paymentResponse.data.qrCodeUrl)) {
        setPaymentId(paymentResponse.data.payment_id);
        
        // Ưu tiên mở payUrl nếu có
        if (paymentResponse.data.payUrl) {
          console.log("Received Pay URL:", paymentResponse.data.payUrl);
          const supported = await Linking.canOpenURL(paymentResponse.data.payUrl);
          if (supported) {
            await Linking.openURL(paymentResponse.data.payUrl);
            Alert.alert(
              'Thông báo',
              'Vui lòng hoàn tất thanh toán trên trang MoMo và quay lại ứng dụng\n\nThông tin test:\nSố điện thoại: 0123456789\nMật khẩu: 000000',
              [{ text: 'OK' }]
            );
             // Đóng modal QR nếu nó đang mở (trong trường hợp trước đó đã mở bằng qrCodeUrl)
            setShowQRModal(false);
          } else {
            Alert.alert('Lỗi', 'Không thể mở trang thanh toán MoMo từ Pay URL');
          }
        } else if (paymentResponse.data.qrCodeUrl) {
          // Nếu chỉ có qrCodeUrl (deep link), có thể hiển thị nó thành text hoặc xử lý khác
          // Hiện tại chúng ta không tạo QR ảnh từ deep link nữa
          console.log("Received QR Code Deep Link (not for QR image):", paymentResponse.data.qrCodeUrl);
           Alert.alert(
            'Thông báo',
            'MoMo trả về deep link QR. Vui lòng mở ứng dụng MoMo để hoàn tất thanh toán.\n\nThông tin test:\nSố điện thoại: 0123456789\nMật khẩu: 000000',
             [{ text: 'OK' }]
           );
          // Tùy chọn: Bạn có thể thử Linking.openURL(paymentResponse.data.qrCodeUrl); 
          // để xem nó có mở ứng dụng MoMo trực tiếp không.
          // await Linking.openURL(paymentResponse.data.qrCodeUrl);
        }
      } else {
        console.error("Invalid MoMo response:", paymentResponse.data);
        Alert.alert('Lỗi', 'Không thể tạo yêu cầu thanh toán MoMo');
      }
    } catch (error) {
      console.error('MoMo Payment Error:', error.response?.data || error);
      const errorMessage = error.response?.data?.error || 'Không thể xử lý thanh toán MoMo';
      const errorDetails = error.response?.data?.details || '';
      Alert.alert('Lỗi', `${errorMessage}${errorDetails ? `\n\nChi tiết: ${errorDetails}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  // Sửa lại hàm handleCreateOrder để trả về response
  const handleCreateOrder = async () => {
    if (!user) {
      Alert.alert('Thông báo', 'Bạn cần đăng nhập để đặt hàng!');
      return null;
    }

    try {
      // Lấy token từ AsyncStorage
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        return null;
      }

      if (!address) {
        Alert.alert('Thông báo', 'Vui lòng nhập địa chỉ giao hàng!');
        return null;
      }

      if (!phoneNumber) {
        Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại!');
        return null;
      }

      if (orderItems.length === 0) {
        Alert.alert('Thông báo', 'Đơn hàng trống!');
        return null;
      }

      // Kiểm tra xem tất cả các món có thuộc cùng một cửa hàng không
      const storeIds = new Set(orderItems.map(item => item.store_id).filter(id => id));
      if (storeIds.size > 1) {
        Alert.alert('Thông báo', 'Hiện tại chỉ có thể đặt món từ một cửa hàng trong một lần đặt hàng');
        return null;
      }
      
      console.info(orderItems[0]?.store_id );
      // Lấy store_id từ món đầu tiên, hoặc dùng ID mặc định nếu không có
      // Đảm bảo storeId là số nguyên
      const rawStoreInfo = orderItems[0]?.store_id;
      const storeId = typeof rawStoreInfo === 'object' && rawStoreInfo !== null
                      ? rawStoreInfo.id // Nếu là object, lấy ID
                      : rawStoreInfo || 1; // Nếu không phải object (hy vọng là số), dùng giá trị đó hoặc mặc định 1

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
      return response;
    } catch (error) {
      console.error('Create Order Error:', error);
      Alert.alert('Lỗi', 'Không thể tạo đơn hàng');
      return null;
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
      await authApi(token).patch(endpoints['confirm-order'](currentOrder.id));
      
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
      await authApi(token).patch(endpoints['deliver-order'](currentOrder.id));
      
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
            <RadioButton.Item label="MoMo" value="momo" />
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
          onPress={paymentMethod === 'momo' ? handleMoMoPayment : handleCreateOrder}
          style={styles.orderButton}
          loading={creatingOrder}
          disabled={creatingOrder}
        >
          {creatingOrder ? 'Đang xử lý...' : 'Đặt hàng'}
        </Button>
      </ScrollView>
    );
  };

  // Modal hiển thị mã QR
  const renderQRModal = () => (
    <Modal
      visible={showQRModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowQRModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Quét mã QR để thanh toán</Text>
          
          {qrCodeUrl ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrCodeUrl}
                size={200}
                backgroundColor="white"
              />
            </View>
          ) : (
            <ActivityIndicator size="large" color="#0000ff" />
          )}

          <Text style={styles.modalText}>
            Thông tin test:{'\n'}
            Số điện thoại: 0123456789{'\n'}
            Mật khẩu: 000000
          </Text>

          <Button
            mode="contained"
            onPress={() => setShowQRModal(false)}
            style={styles.modalButton}
          >
            Đóng
          </Button>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {isExistingOrder ? renderExistingOrder() : renderCreateOrderForm()}
      {renderQRModal()}
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    width: '100%',
  },
});

export default OrderScreen;