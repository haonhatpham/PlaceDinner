import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, endpoints } from '../../configs/API/api';

const OrderListScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        Alert.alert('Thông báo', 'Bạn cần đăng nhập để xem đơn hàng!');
        setLoading(false);
        return;
      }
      try {
        const api = authApi(token);
        const res = await api.get(endpoints['my-orders']);
        setOrders(res.data);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!');
        } else {
          Alert.alert('Lỗi', 'Không thể lấy danh sách đơn hàng!');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={orders}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Order', { order: item })}>
            <Text style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
              Đơn hàng #{item.id} - {item.status}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>Không có đơn hàng nào.</Text>}
      />
    </View>
  );
};

export default OrderListScreen; 