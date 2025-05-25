import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Chip, Portal, Dialog } from 'react-native-paper';
import { MyUserContext } from '../../configs/Contexts';
import MyStyles from '../../styles/MyStyles';
import { authApi, endpoints } from '../../configs/Apis';

const StoreOrders = () => {
    const [user] = useContext(MyUserContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dialogVisible, setDialogVisible] = useState(false);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        if (!user) return;
        
        try {
            setLoading(true);
            const res = await authApi(user.access_token).get(endpoints['store-orders']);
            setOrders(res.data);
        } catch (error) {
            console.error('Lỗi tải danh sách đơn hàng:', error);
            Alert.alert('Lỗi', 'Không thể tải danh sách đơn hàng');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmOrder = async (orderId) => {
        if (!user) return;
        
        try {
            await authApi(user.access_token).post(endpoints['confirm-order'](orderId));
            Alert.alert('Thành công', 'Đã xác nhận đơn hàng');
            loadOrders();
        } catch (error) {
            console.error('Lỗi xác nhận đơn hàng:', error);
            Alert.alert('Lỗi', 'Không thể xác nhận đơn hàng');
        }
    };

    const handleDeliverOrder = async (orderId) => {
        if (!user) return;
        
        try {
            await authApi(user.access_token).post(endpoints['deliver-order'](orderId));
            Alert.alert('Thành công', 'Đã ghi nhận giao hàng');
            loadOrders();
        } catch (error) {
            console.error('Lỗi ghi nhận giao hàng:', error);
            Alert.alert('Lỗi', 'Không thể ghi nhận giao hàng');
        }
    };

    const getStatusChip = (status) => {
        let color = '#666';
        let icon = 'clock';
        
        switch (status) {
            case 'PENDING':
                color = '#FFA000';
                icon = 'clock-outline';
                break;
            case 'CONFIRMED':
                color = '#2196F3';
                icon = 'check-circle-outline';
                break;
            case 'DELIVERED':
                color = '#4CAF50';
                icon = 'truck-check';
                break;
            case 'CANCELLED':
                color = '#F44336';
                icon = 'close-circle-outline';
                break;
        }

        return (
            <Chip
                icon={icon}
                style={[styles.statusChip, { backgroundColor: color }]}
                textStyle={{ color: '#fff' }}
            >
                {getStatusLabel(status)}
            </Chip>
        );
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'PENDING': return 'Chờ xác nhận';
            case 'CONFIRMED': return 'Đã xác nhận';
            case 'DELIVERED': return 'Đã giao hàng';
            case 'CANCELLED': return 'Đã hủy';
            default: return 'Không xác định';
        }
    };

    const showOrderDetails = (order) => {
        setSelectedOrder(order);
        setDialogVisible(true);
    };

    return (
        <View style={styles.container}>
            <ScrollView>
                <Text style={MyStyles.title}>Quản lý đơn hàng</Text>
                
                {orders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Chưa có đơn hàng nào</Text>
                    </View>
                ) : (
                    orders.map(order => (
                        <Card key={order.id} style={styles.orderCard}>
                            <Card.Content>
                                <View style={styles.orderHeader}>
                                    <Text style={styles.orderId}>Đơn hàng #{order.id}</Text>
                                    {getStatusChip(order.status)}
                                </View>
                                
                                <Text style={styles.customerInfo}>
                                    Khách hàng: {order.customer_name}
                                </Text>
                                <Text style={styles.customerInfo}>
                                    SĐT: {order.customer_phone}
                                </Text>
                                <Text style={styles.address}>
                                    Địa chỉ: {order.delivery_address}
                                </Text>
                                
                                <Text style={styles.total}>
                                    Tổng tiền: {order.total_amount?.toLocaleString('vi-VN')}đ
                                </Text>
                            </Card.Content>
                            
                            <Card.Actions>
                                <Button onPress={() => showOrderDetails(order)}>
                                    Chi tiết
                                </Button>
                                
                                {order.status === 'PENDING' && (
                                    <Button onPress={() => handleConfirmOrder(order.id)}>
                                        Xác nhận
                                    </Button>
                                )}
                                
                                {order.status === 'CONFIRMED' && (
                                    <Button onPress={() => handleDeliverOrder(order.id)}>
                                        Ghi nhận giao hàng
                                    </Button>
                                )}
                            </Card.Actions>
                        </Card>
                    ))
                )}
            </ScrollView>

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>Chi tiết đơn hàng #{selectedOrder?.id}</Dialog.Title>
                    <Dialog.Content>
                        {selectedOrder?.items?.map((item, index) => (
                            <View key={index} style={styles.orderItem}>
                                <Text style={styles.itemName}>{item.food_name}</Text>
                                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                                <Text style={styles.itemPrice}>
                                    {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                                </Text>
                            </View>
                        ))}
                        <View style={styles.orderSummary}>
                            <Text style={styles.summaryLabel}>Tổng tiền:</Text>
                            <Text style={styles.summaryValue}>
                                {selectedOrder?.total_amount?.toLocaleString('vi-VN')}đ
                            </Text>
                        </View>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Đóng</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    orderCard: {
        marginBottom: 16,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderId: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusChip: {
        marginLeft: 8,
    },
    customerInfo: {
        fontSize: 14,
        marginBottom: 4,
    },
    address: {
        fontSize: 14,
        marginBottom: 8,
    },
    total: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    emptyContainer: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
    },
    orderItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemName: {
        flex: 2,
    },
    itemQuantity: {
        flex: 1,
        textAlign: 'center',
    },
    itemPrice: {
        flex: 1,
        textAlign: 'right',
    },
    orderSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    summaryLabel: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3',
    },
});

export default StoreOrders; 