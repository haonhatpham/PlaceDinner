import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, Button, Card, SegmentedButtons, DataTable } from 'react-native-paper';
import MyStyles from '../../styles/MyStyles';
import { authApi, endpoints } from '../../configs/Apis';
import { MyUserContext } from '../../configs/Contexts';

const RevenueStats = () => {
    const user = useContext(MyUserContext);
    const [timeRange, setTimeRange] = useState('month');
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedQuarter, setSelectedQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));
    const [revenueData, setRevenueData] = useState({
        total_orders: 0,
        total_revenue: 0
    });

    // Hàm lấy dữ liệu thống kê
    const fetchRevenueStats = async () => {
        try {
            setLoading(true);
            let endpoint = '';
            let params = `?year=${selectedYear}`;

            // Xác định endpoint dựa vào timeRange
            switch (timeRange) {
                case 'month':
                    endpoint = `/stores/${user.store.id}/revenue/month`;
                    params += `&month=${selectedMonth}`;
                    break;
                case 'quarter':
                    endpoint = `/stores/${user.store.id}/revenue/quarter`;
                    params += `&quarter=${selectedQuarter}`;
                    break;
                case 'year':
                    endpoint = `/stores/${user.store.id}/revenue/year`;
                    break;
            }

            const response = await authApi(user.token).get(endpoint + params);
            setRevenueData(response.data);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu thống kê:', error);
        } finally {
            setLoading(false);
        }
    };

    // Gọi API khi thay đổi các tham số
    useEffect(() => {
        fetchRevenueStats();
    }, [timeRange, selectedYear, selectedMonth, selectedQuarter]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    return (
        <ScrollView style={MyStyles.container}>
            <View style={MyStyles.m}>
                <Text style={MyStyles.title}>Thống Kê Doanh Thu</Text>

                {/* Chọn khoảng thời gian */}
                <SegmentedButtons
                    value={timeRange}
                    onValueChange={setTimeRange}
                    buttons={[
                        { value: 'month', label: 'Tháng' },
                        { value: 'quarter', label: 'Quý' },
                        { value: 'year', label: 'Năm' }
                    ]}
                    style={[MyStyles.m, { marginVertical: 10 }]}
                />

                {/* Chọn thời gian cụ thể */}
                <View style={[MyStyles.m, MyStyles.row]}>
                    <Button mode="outlined" style={{ marginRight: 10 }}>
                        Năm: {selectedYear}
                    </Button>
                    
                    {timeRange === 'month' && (
                        <Button mode="outlined" style={{ marginRight: 10 }}>
                            Tháng: {selectedMonth}
                        </Button>
                    )}
                    
                    {timeRange === 'quarter' && (
                        <Button mode="outlined">
                            Quý: {selectedQuarter}
                        </Button>
                    )}
                </View>

                {/* Tổng quan */}
                <Card style={MyStyles.m}>
                    <Card.Title title="Tổng Quan" />
                    <Card.Content>
                        <Text style={MyStyles.text}>Tổng số đơn hàng: {revenueData.total_orders}</Text>
                        <Text style={MyStyles.text}>Tổng doanh thu: {formatCurrency(revenueData.total_revenue)}</Text>
                    </Card.Content>
                </Card>

                {/* Nút làm mới */}
                <Button 
                    mode="contained" 
                    onPress={fetchRevenueStats}
                    loading={loading}
                    style={MyStyles.m}
                >
                    Làm mới dữ liệu
                </Button>
            </View>
        </ScrollView>
    );
};

export default RevenueStats; 