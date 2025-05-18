// import React, { useState, useEffect, useContext } from 'react';
// import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
// import { Text, Card, Button, SegmentedButtons } from 'react-native-paper';
// import { MyUserContext } from '../../configs/Contexts';
// import MyStyles from '../../styles/MyStyles';
// import { authApi, endpoints } from '../../configs/Apis';
// import { LineChart, BarChart } from 'react-native-chart-kit';

// const RevenueStats = () => {
//     const user = useContext(MyUserContext);
//     const [timeRange, setTimeRange] = useState('month');
//     const [stats, setStats] = useState({
//         revenue: [],
//         orders: [],
//         topProducts: [],
//         topCategories: []
//     });

//     useEffect(() => {
//         loadStats();
//     }, [timeRange]);

//     const loadStats = async () => {
//         try {
//             const [revenueRes, ordersRes, productsRes, categoriesRes] = await Promise.all([
//                 authApi(user.token).get(endpoints['store-revenue'](user.account.store.id), {
//                     params: { time_range: timeRange }
//                 }),
//                 authApi(user.token).get(endpoints['store-orders-stats'](user.account.store.id), {
//                     params: { time_range: timeRange }
//                 }),
//                 authApi(user.token).get(endpoints['store-foods-stats'](user.account.store.id), {
//                     params: { time_range: timeRange }
//                 }),
//                 authApi(user.token).get(endpoints['store-categories-stats'](user.account.store.id), {
//                     params: { time_range: timeRange }
//                 })
//             ]);

            setStats({
                revenue: revenueRes.data,
                orders: ordersRes.data,
                topProducts: productsRes.data,
                topCategories: categoriesRes.data
            });
        } catch (error) {
            console.error('Lỗi tải thống kê:', error);
        }
    };

    const chartConfig = {
        backgroundGradientFrom: '#ffffff',
        backgroundGradientTo: '#ffffff',
        color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false
    };

    const screenWidth = Dimensions.get('window').width;

    return (
        <ScrollView style={styles.container}>
            <Text style={MyStyles.title}>Thống kê doanh thu</Text>

            <SegmentedButtons
                value={timeRange}
                onValueChange={setTimeRange}
                buttons={[
                    { value: 'month', label: 'Tháng' },
                    { value: 'quarter', label: 'Quý' },
                    { value: 'year', label: 'Năm' }
                ]}
                style={styles.segmentedButtons}
            />

            {/* Biểu đồ doanh thu */}
            <Card style={styles.card}>
                <Card.Title title="Doanh thu theo thời gian" />
                <Card.Content>
                    <LineChart
                        data={{
                            labels: stats.revenue.map(item => item.label),
                            datasets: [{
                                data: stats.revenue.map(item => item.value)
                            }]
                        }}
                        width={screenWidth - 32}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                    />
                </Card.Content>
            </Card>

            {/* Biểu đồ đơn hàng */}
            <Card style={styles.card}>
                <Card.Title title="Số lượng đơn hàng" />
                <Card.Content>
                    <BarChart
                        data={{
                            labels: stats.orders.map(item => item.label),
                            datasets: [{
                                data: stats.orders.map(item => item.value)
                            }]
                        }}
                        width={screenWidth - 32}
                        height={220}
                        chartConfig={chartConfig}
                        style={styles.chart}
                    />
                </Card.Content>
            </Card>

            {/* Top sản phẩm bán chạy */}
            <Card style={styles.card}>
                <Card.Title title="Top sản phẩm bán chạy" />
                <Card.Content>
                    {stats.topProducts.map((product, index) => (
                        <View key={index} style={styles.listItem}>
                            <Text style={styles.rank}>#{index + 1}</Text>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{product.name}</Text>
                                <Text style={styles.itemStats}>
                                    Đã bán: {product.quantity} | Doanh thu: {product.revenue.toLocaleString('vi-VN')}đ
                                </Text>
                            </View>
                        </View>
                    ))}
                </Card.Content>
            </Card>

            {/* Top danh mục */}
            <Card style={styles.card}>
                <Card.Title title="Top danh mục" />
                <Card.Content>
                    {stats.topCategories.map((category, index) => (
                        <View key={index} style={styles.listItem}>
                            <Text style={styles.rank}>#{index + 1}</Text>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName}>{category.name}</Text>
                                <Text style={styles.itemStats}>
                                    Doanh thu: {category.revenue.toLocaleString('vi-VN')}đ
                                </Text>
                            </View>
                        </View>
                    ))}
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    segmentedButtons: {
        marginBottom: 16,
    },
    card: {
        marginBottom: 16,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    rank: {
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 12,
        color: '#666',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
    },
    itemStats: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
});

export default RevenueStats; 