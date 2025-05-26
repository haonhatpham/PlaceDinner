import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, FAB, Portal, Dialog, Chip, SegmentedButtons } from 'react-native-paper';
import { MyUserContext } from '../../configs/Contexts';
import MyStyles from '../../styles/MyStyles';
import { authApi, endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const MEAL_TIMES = [
    { value: 'BREAKFAST', label: 'Bữa sáng', time: '06:00 - 10:00' },
    { value: 'LUNCH', label: 'Bữa trưa', time: '11:00 - 14:00' },
    { value: 'DINNER', label: 'Bữa tối', time: '17:00 - 21:00' }
];

const ManageMenus = () => {
    const user = useContext(MyUserContext);
    const [foods, setFoods] = useState([]);
    const [selectedMealTime, setSelectedMealTime] = useState('BREAKFAST');
    const [visible, setVisible] = useState(false);
    const [selectedFoods, setSelectedFoods] = useState([]);

    useEffect(() => {
        if (user && user.store) {
            loadFoods();
        }
    }, [user]);

    const loadFoods = async () => {
        if (!user || !user.store) return;
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await authApi(token).get(endpoints['store-foods']);
            setFoods(res.data);
        } catch (error) {
            console.error('Lỗi tải danh sách món:', error);
        }
    };

    const handleMealTimeChange = (value) => {
        setSelectedMealTime(value);
        // Lọc các món ăn theo meal_time
        const foodsForMealTime = foods.filter(food => food.meal_time === value);
        setSelectedFoods(foodsForMealTime.map(f => f.id));
    };

    const toggleFoodSelection = (foodId) => {
        setSelectedFoods(prev => {
            if (prev.includes(foodId)) {
                return prev.filter(id => id !== foodId);
            } else {
                return [...prev, foodId];
            }
        });
    };

    const saveMenu = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            // Tạo tên menu tự động theo định dạng: "Menu [Bữa ăn] - [Ngày/Tháng]"
            const currentDate = new Date();
            const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
            const menuName = `Menu ${MEAL_TIMES.find(m => m.value === selectedMealTime)?.label} - ${formattedDate}`;

            // Kiểm tra dữ liệu trước khi gửi
            if (selectedFoods.length === 0) {
                Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một món ăn cho menu');
                return;
            }

            const data = {
                name: menuName,
                menu_type: selectedMealTime,
                foods: selectedFoods
            };
            
            console.log('Sending request to:', endpoints['store-menus']);
            console.log('Request data:', JSON.stringify(data, null, 2));
            
            const response = await authApi(token).post(endpoints['store-menus'], data);
            console.log('Response:', response.data);
            
            Alert.alert('Thành công', 'Đã lưu menu thành công');
            setVisible(false);
        } catch (error) {
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                data: error.response?.config?.data
            });
            Alert.alert(
                'Lỗi',
                error.response?.data?.detail || 'Không thể lưu menu. Vui lòng thử lại.'
            );
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView>
                <Text style={MyStyles.title}>Quản lý Menu</Text>

                <SegmentedButtons
                    value={selectedMealTime}
                    onValueChange={handleMealTimeChange}
                    buttons={MEAL_TIMES.map(meal => ({
                        value: meal.value,
                        label: meal.label,
                    }))}
                    style={styles.mealTimeSelector}
                />

                <Text style={styles.timeInfo}>
                    Thời gian: {MEAL_TIMES.find(m => m.value === selectedMealTime)?.time}
                </Text>

                <View style={styles.foodList}>
                    {foods.map(food => (
                        <Card key={food.id} style={[
                            styles.foodCard,
                            selectedFoods.includes(food.id) && styles.selectedCard
                        ]}>
                            <Card.Title
                                title={food.name}
                                subtitle={`${food.price.toLocaleString('vi-VN')}đ`}
                                right={() => (
                                    <Button
                                        onPress={() => toggleFoodSelection(food.id)}
                                    >
                                        {selectedFoods.includes(food.id) ? 'Bỏ chọn' : 'Chọn'}
                                    </Button>
                                )}
                            />
                            <Card.Content>
                                <View style={styles.chipContainer}>
                                    <Chip icon="clock">
                                        {MEAL_TIMES.find(m => m.value === food.meal_time)?.label || 'Cả ngày'}
                                    </Chip>
                                    {food.is_available ? (
                                        <Chip icon="check" style={styles.availableChip}>Còn hàng</Chip>
                                    ) : (
                                        <Chip icon="close" style={styles.unavailableChip}>Hết hàng</Chip>
                                    )}
                                </View>
                            </Card.Content>
                        </Card>
                    ))}
                </View>
            </ScrollView>
            <FAB
                style={styles.fab}
                icon="content-save"
                label="Lưu Menu"
                onPress={() => setVisible(true)}
            />

            <Portal>
                <Dialog visible={visible} onDismiss={() => setVisible(false)}>
                    <Dialog.Title>Xác nhận lưu menu</Dialog.Title>
                    <Dialog.Content>
                        <Text>
                            Bạn đã chọn {selectedFoods.length} món cho {MEAL_TIMES.find(m => m.value === selectedMealTime)?.label.toLowerCase()}.
                            Xác nhận lưu menu?
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setVisible(false)}>Hủy</Button>
                        <Button onPress={saveMenu}>Lưu</Button>
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
    mealTimeSelector: {
        marginBottom: 16,
    },
    timeInfo: {
        fontSize: 16,
        marginBottom: 16,
        color: '#666',
    },
    foodList: {
        gap: 12,
    },
    foodCard: {
        marginBottom: 8,
    },
    selectedCard: {
        backgroundColor: '#e3f2fd',
    },
    chipContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    availableChip: {
        backgroundColor: '#4CAF50',
    },
    unavailableChip: {
        backgroundColor: '#F44336',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});

export default ManageMenus; 