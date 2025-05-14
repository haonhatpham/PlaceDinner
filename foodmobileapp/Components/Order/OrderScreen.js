import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OrderScreen = ({ route, navigation }) => {
  const { order } = route.params;
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      const api = authApi(token);

      // Tạo thanh toán
      const response = await api.post(endpoints['create-payment'](order.id), {
        payment_method: paymentMethod
      });

      // Xử lý thanh toán dựa trên phương thức
      if (paymentMethod === 'paypal') {
        // Mở PayPal WebView
        navigation.navigate('PaymentWebView', {
          url: response.data.payment_url,
          orderId: order.id
        });
      } else if (paymentMethod === 'stripe') {
        // Mở Stripe Payment Sheet
        navigation.navigate('StripePayment', {
          clientSecret: response.data.client_secret,
          orderId: order.id
        });
      } else if (paymentMethod === 'momo') {
        // Mở Momo WebView
        navigation.navigate('PaymentWebView', {
          url: response.data.payment_url,
          orderId: order.id
        });
      } else if (paymentMethod === 'zalopay') {
        // Mở ZaloPay WebView
        navigation.navigate('PaymentWebView', {
          url: response.data.payment_url,
          orderId: order.id
        });
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tạo thanh toán');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
          <Text>Mã đơn: {order.id}</Text>
          <Text>Tổng tiền: {order.total_amount.toLocaleString('vi-VN')}đ</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn phương thức thanh toán</Text>
          <TouchableOpacity
            style={[styles.paymentMethod, paymentMethod === 'paypal' && styles.selectedMethod]}
            onPress={() => setPaymentMethod('paypal')}
          >
            <Text>PayPal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.paymentMethod, paymentMethod === 'stripe' && styles.selectedMethod]}
            onPress={() => setPaymentMethod('stripe')}
          >
            <Text>Stripe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.paymentMethod, paymentMethod === 'momo' && styles.selectedMethod]}
            onPress={() => setPaymentMethod('momo')}
          >
            <Text>Momo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.paymentMethod, paymentMethod === 'zalopay' && styles.selectedMethod]}
            onPress={() => setPaymentMethod('zalopay')}
          >
            <Text>ZaloPay</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.payButton, !paymentMethod && styles.disabledButton]}
          onPress={handlePayment}
          disabled={!paymentMethod || loading}
        >
          <Text style={styles.payButtonText}>
            {loading ? 'Đang xử lý...' : 'Thanh toán'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  paymentMethod: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
  },
  selectedMethod: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  payButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    margin: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrderScreen;