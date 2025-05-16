import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Button, Card, SegmentedButtons, Portal, Modal, List } from 'react-native-paper';
import MyStyles from '../../styles/MyStyles';
import api, { authApi, endpoints } from '../../configs/Apis';
import { MyUserContext } from '../../configs/Contexts';
import { useNavigation } from '@react-navigation/native';

const RevenueStats = ({ route }) => {
    const user = useContext(MyUserContext);
    const navigation = useNavigation();
    
    const [storeId, setStoreId] = useState(route?.params?.storeId);
    
    console.log("RevenueStats - Route Params:", JSON.stringify(route?.params, null, 2));
    console.log("RevenueStats - Initial Store ID:", storeId);
    console.log("RevenueStats - User Data:", JSON.stringify(user, null, 2));

    // Fetch store ID if not available
    useEffect(() => {
        const fetchStoreId = async () => {
            if (!storeId && user?.store?.name) {
                try {
                    const response = await api.get(endpoints.stores);
                    const store = response.data.find(s => s.name === user.store.name);
                    if (store?.id) {
                        console.log("Found store ID:", store.id);
                        setStoreId(store.id);
                    }
                } catch (error) {
                    console.error("Error fetching store ID:", error);
                    setError("Không thể lấy thông tin cửa hàng");
                }
            }
        };
        fetchStoreId();
    }, [user]);

    const [timeRange, setTimeRange] = useState('month');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedQuarter, setSelectedQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));
    const [revenueData, setRevenueData] = useState({
        total_orders: 0,
        total_revenue: 0
    });

    // State cho modal
    const [yearModalVisible, setYearModalVisible] = useState(false);
    const [monthModalVisible, setMonthModalVisible] = useState(false);
    const [quarterModalVisible, setQuarterModalVisible] = useState(false);

    // Tạo mảng năm từ 2020 đến năm hiện tại
    const years = Array.from({length: new Date().getFullYear() - 2019}, (_, i) => 2020 + i);
    const months = Array.from({length: 12}, (_, i) => i + 1);
    const quarters = [1, 2, 3, 4];

    // Hàm lấy dữ liệu thống kê
    const fetchRevenueStats = async () => {
        if (!storeId) {
            setError('Không tìm thấy thông tin cửa hàng');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            let endpoint = '';
            let params = `?year=${selectedYear}`;

            // Xác định endpoint dựa vào timeRange
            switch (timeRange) {
                case 'month':
                    endpoint = endpoints['store-revenue'](storeId) + 'month';
                    params += `&month=${selectedMonth}`;
                    break;
                case 'quarter':
                    endpoint = endpoints['store-revenue'](storeId) + 'quarter';
                    params += `&quarter=${selectedQuarter}`;
                    break;
                case 'year':
                    endpoint = endpoints['store-revenue'](storeId) + 'year';
                    break;
            }

            console.log('Calling API:', endpoint + params);
            const response = await authApi(user.token).get(endpoint + params);
            console.log('API Response:', response.data);
            setRevenueData(response.data);
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu thống kê:', error.response?.data || error.message);
            setError('Không thể lấy dữ liệu thống kê. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Kiểm tra xem có thông tin store không
    useEffect(() => {
        if (!storeId) {
            setError('Không tìm thấy thông tin cửa hàng');
            return;
        }
        fetchRevenueStats();
    }, [storeId]);

    // Gọi API khi thay đổi các tham số
    useEffect(() => {
        if (storeId) {
            fetchRevenueStats();
        }
    }, [timeRange, selectedYear, selectedMonth, selectedQuarter]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    if (error) {
        return (
            <View style={[MyStyles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
                <Button mode="contained" onPress={() => navigation.goBack()}>
                    Quay lại
                </Button>
            </View>
        );
    }

    return (
        <>
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
                        <Button 
                            mode="outlined" 
                            style={{ marginRight: 10 }}
                            onPress={() => setYearModalVisible(true)}
                        >
                            Năm: {selectedYear}
                        </Button>
                        
                        {timeRange === 'month' && (
                            <Button 
                                mode="outlined" 
                                style={{ marginRight: 10 }}
                                onPress={() => setMonthModalVisible(true)}
                            >
                                Tháng: {selectedMonth}
                            </Button>
                        )}
                        
                        {timeRange === 'quarter' && (
                            <Button 
                                mode="outlined"
                                onPress={() => setQuarterModalVisible(true)}
                            >
                                Quý: {selectedQuarter}
                            </Button>
                        )}
                    </View>

                    {/* Tổng quan */}
                    <Card style={MyStyles.m}>
                        <Card.Title title="Tổng Quan" />
                        <Card.Content>
                            {loading ? (
                                <ActivityIndicator size="large" />
                            ) : (
                                <>
                                    <Text style={MyStyles.text}>Tổng số đơn hàng: {revenueData.total_orders}</Text>
                                    <Text style={MyStyles.text}>Tổng doanh thu: {formatCurrency(revenueData.total_revenue)}</Text>
                                </>
                            )}
                        </Card.Content>
                    </Card>

                    {/* Nút làm mới */}
                    <Button 
                        mode="contained" 
                        onPress={fetchRevenueStats}
                        loading={loading}
                        style={MyStyles.m}
                        disabled={loading}
                    >
                        Làm mới dữ liệu
                    </Button>
                </View>
            </ScrollView>

            {/* Modal chọn năm */}
            <Portal>
                <Modal
                    visible={yearModalVisible}
                    onDismiss={() => setYearModalVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: 'white',
                        padding: 20,
                        margin: 20,
                        maxHeight: '80%'
                    }}
                >
                    <ScrollView>
                        <List.Section>
                            <List.Subheader>Chọn năm</List.Subheader>
                            {years.map(year => (
                                <List.Item
                                    key={year}
                                    title={year.toString()}
                                    onPress={() => {
                                        setSelectedYear(year);
                                        setYearModalVisible(false);
                                    }}
                                    right={props => selectedYear === year && <List.Icon {...props} icon="check" />}
                                />
                            ))}
                        </List.Section>
                    </ScrollView>
                </Modal>

                {/* Modal chọn tháng */}
                <Modal
                    visible={monthModalVisible}
                    onDismiss={() => setMonthModalVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: 'white',
                        padding: 20,
                        margin: 20,
                        maxHeight: '80%'
                    }}
                >
                    <ScrollView>
                        <List.Section>
                            <List.Subheader>Chọn tháng</List.Subheader>
                            {months.map(month => (
                                <List.Item
                                    key={month}
                                    title={`Tháng ${month}`}
                                    onPress={() => {
                                        setSelectedMonth(month);
                                        setMonthModalVisible(false);
                                    }}
                                    right={props => selectedMonth === month && <List.Icon {...props} icon="check" />}
                                />
                            ))}
                        </List.Section>
                    </ScrollView>
                </Modal>

                {/* Modal chọn quý */}
                <Modal
                    visible={quarterModalVisible}
                    onDismiss={() => setQuarterModalVisible(false)}
                    contentContainerStyle={{
                        backgroundColor: 'white',
                        padding: 20,
                        margin: 20
                    }}
                >
                    <List.Section>
                        <List.Subheader>Chọn quý</List.Subheader>
                        {quarters.map(quarter => (
                            <List.Item
                                key={quarter}
                                title={`Quý ${quarter}`}
                                onPress={() => {
                                    setSelectedQuarter(quarter);
                                    setQuarterModalVisible(false);
                                }}
                                right={props => selectedQuarter === quarter && <List.Icon {...props} icon="check" />}
                            />
                        ))}
                    </List.Section>
                </Modal>
            </Portal>
        </>
    );
};

export default RevenueStats; 