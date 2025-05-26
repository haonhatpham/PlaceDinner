import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { Text, Card, Button, FAB, Portal, Dialog, TextInput, HelperText, Switch, Chip } from 'react-native-paper';
import { MyUserContext } from '../../configs/Contexts';
import MyStyles from '../../styles/MyStyles';
import { authApi, endpoints } from '../../configs/Apis';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Thêm constants cho thời gian mặc định của các bữa
const MEAL_TIME_RANGES = {
    BREAKFAST: { start: '06:00', end: '10:00' },
    LUNCH: { start: '11:00', end: '14:00' },
    DINNER: { start: '17:00', end: '21:00' },
    ANYTIME: { start: '00:00', end: '23:59' }
};

// Map chính xác với backend MealTime choices
const MEAL_TIME_CHOICES = [
    { value: 'BREAKFAST', label: 'Bữa sáng' },
    { value: 'LUNCH', label: 'Bữa trưa' },
    { value: 'DINNER', label: 'Bữa tối' },
    { value: 'ANYTIME', label: 'Cả ngày' }
];

const ManageFoods = () => {
    const navigation = useNavigation();
    const user = useContext(MyUserContext);
    console.log('Thông tin user:', user);
    const [foods, setFoods] = useState([]);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [food, setFood] = useState({
        name: '',
        price: '',
        description: '',
        category: '',
        image: null,
        food_image: null,
        is_available: true,
        meal_time: 'ANYTIME',
        available_from: null,  // Thay đổi để khớp với backend (có thể null)
        available_to: null     // Thay đổi để khớp với backend (có thể null)
    });

    const validateTimeFormat = (time) => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const isTimeInRange = (time, startRange, endRange) => {
        const [hours, minutes] = time.split(':').map(Number);
        const [startHours, startMinutes] = startRange.split(':').map(Number);
        const [endHours, endMinutes] = endRange.split(':').map(Number);
        
        const currentTimeMinutes = hours * 60 + minutes;
        const rangeStartMinutes = startHours * 60 + startMinutes;
        const rangeEndMinutes = endHours * 60 + endMinutes;
        
        return currentTimeMinutes >= rangeStartMinutes && currentTimeMinutes <= rangeEndMinutes;
    };

    const handleMealTimeChange = (value) => {
        try {
            if (!MEAL_TIME_RANGES[value]) {
                console.error('Invalid meal time selected:', value);
                value = 'ANYTIME';
            }

            const timeRange = MEAL_TIME_RANGES[value];
            setFood({
                ...food,
                meal_time: value,
                available_from: timeRange.start,
                available_to: timeRange.end
            });
        } catch (error) {
            console.error('Error in handleMealTimeChange:', error);
            // Fallback to safe default values
            setFood({
                ...food,
                meal_time: 'ANYTIME',
                available_from: MEAL_TIME_RANGES.ANYTIME.start,
                available_to: MEAL_TIME_RANGES.ANYTIME.end
            });
        }
    };

    const handleTimeChange = (type, value) => {
        try {
            if (!validateTimeFormat(value)) {
                return;
            }

            const timeRange = MEAL_TIME_RANGES[food.meal_time];
            if (!timeRange) {
                console.error('Invalid meal time:', food.meal_time);
                return;
            }

            if (!isTimeInRange(value, timeRange.start, timeRange.end)) {
                Alert.alert(
                    'Thời gian không hợp lệ',
                    `${getMealTimeLabel(food.meal_time)} phải nằm trong khoảng ${timeRange.start} - ${timeRange.end}`
                );
                return;
            }

            setFood({
                ...food,
                [type]: value
            });
        } catch (error) {
            console.error('Error in handleTimeChange:', error);
        }
    };

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

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
            });

            if (!result.canceled) {
                const selectedAsset = result.assets[0];
                setFood({
                    ...food,
                    food_image: {
                        uri: selectedAsset.uri,
                        type: 'image/jpeg',
                        name: 'food_image.jpg'
                    }
                });
            }
        } catch (error) {
            console.error('Lỗi chọn ảnh:', error);
        }
    };

    const getMealTimeLabel = (value) => {
        const found = MEAL_TIME_CHOICES.find(choice => choice.value === value);
        return found ? found.label : 'Cả ngày';
    };

    const handleEditFood = (foodToEdit) => {
        try {
            // Đảm bảo meal_time là một trong các giá trị hợp lệ
            const validMealTime = MEAL_TIME_CHOICES.some(choice => choice.value === foodToEdit.meal_time)
                ? foodToEdit.meal_time
                : 'ANYTIME';

            setFood({
                ...foodToEdit,
                food_image: null,
                meal_time: validMealTime,
                // Giữ nguyên giá trị từ backend nếu có, nếu không thì dùng mặc định
                available_from: foodToEdit.available_from || MEAL_TIME_RANGES[validMealTime].start,
                available_to: foodToEdit.available_to || MEAL_TIME_RANGES[validMealTime].end
            });
            setVisible(true);
        } catch (error) {
            console.error('Error in handleEditFood:', error);
            setFood({
                ...foodToEdit,
                food_image: null,
                meal_time: 'ANYTIME',
                available_from: null,
                available_to: null
            });
            setVisible(true);
        }
    };

    const handleAddFood = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const formData = new FormData();
            
            formData.append('name', food.name);
            formData.append('description', food.description);
            formData.append('price', food.price);
            formData.append('meal_time', food.meal_time);
            formData.append('is_available', food.is_available);
            if (food.category) formData.append('category', food.category);
            if (food.food_image) formData.append('image', food.food_image);
            if (food.available_from) formData.append('available_from', food.available_from);
            if (food.available_to) formData.append('available_to', food.available_to);
            
            if (user && user.store) {
                formData.append('store', user.store.id);
            } else {
                Alert.alert('Lỗi', 'Không tìm thấy thông tin cửa hàng');
                return;
            }

            if (food.id) {
                // Nếu có id nghĩa là đang sửa món ăn
                await authApi(token).patch(endpoints['food_detail'](food.id), formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            } else {
                // Thêm món ăn mới
                await authApi(token).post(endpoints['store-foods'], formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
            }
            
            setVisible(false);
            setFood({
                name: '',
                price: '',
                description: '',
                category: '',
                image: null,
                food_image: null,
                is_available: true,
                meal_time: 'ANYTIME',
                available_from: null,
                available_to: null
            });
            loadFoods();
        } catch (error) {
            if (error.response) {
                console.log('Lỗi:', error.response.data);
                Alert.alert('Lỗi', 'Không thể lưu món ăn. Vui lòng thử lại.');
            } else {
                console.log('Lỗi:', error);
                Alert.alert('Lỗi', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAvailability = async (foodId, currentStatus) => {
        try {
            const token = await AsyncStorage.getItem('token');
            await authApi(token).patch(endpoints['update-food-availability'](foodId), {
                is_available: !currentStatus
            });
            loadFoods();
        } catch (error) {
            console.error('Lỗi cập nhật trạng thái:', error);
        }
    };

    const handleDeleteFood = async (foodId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            await authApi(token).delete(endpoints['food_detail'](foodId));
            loadFoods();
        } catch (error) {
            console.error('Lỗi xóa món:', error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={MyStyles.title}>Quản lý món ăn</Text>
                <Button 
                    mode="contained" 
                    icon="menu" 
                    onPress={() => navigation.navigate('ManageMenus')}
                    style={styles.menuButton}
                >
                    Quản lý Menu
                </Button>
            </View>
            
            <ScrollView>
                {foods.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Cửa hàng chưa có món nào</Text>
                    </View>
                ) : (
                    foods.map(food => (
                        <Card key={food.id} style={styles.foodCard}>
                            <Card.Cover source={{ uri: food.food_image || food.image }} />
                            <Card.Title 
                                title={food.name}
                                subtitle={`${food.price.toLocaleString('vi-VN')}đ`}
                            />
                            <Card.Content>
                                <Text>{food.description}</Text>
                                <View style={styles.foodInfo}>
                                    <Chip icon="clock" style={styles.chip}>
                                        {getMealTimeLabel(food.meal_time)}
                                    </Chip>
                                    <Chip 
                                        icon={food.is_available ? "check" : "close"}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: food.is_available ? '#4CAF50' : '#F44336' }
                                        ]}
                                    >
                                        {food.is_available ? 'Còn hàng' : 'Hết hàng'}
                                    </Chip>
                                </View>
                                {(food.available_from && food.available_to) && (
                                    <Text style={styles.timeRange}>
                                        Giờ bán: {food.available_from} - {food.available_to}
                                    </Text>
                                )}
                            </Card.Content>
                            <Card.Actions>
                                <Button onPress={() => handleEditFood(food)}>Sửa</Button>
                                <Button onPress={() => handleToggleAvailability(food.id, food.is_available)}>
                                    {food.is_available ? 'Đánh dấu hết hàng' : 'Đánh dấu còn hàng'}
                                </Button>
                                <Button onPress={() => handleDeleteFood(food.id)}>Xóa</Button>
                            </Card.Actions>
                        </Card>
                    ))
                )}
            </ScrollView>

            <Portal>
                <Dialog visible={visible} onDismiss={() => {
                    setVisible(false);
                    setFood({
                        name: '',
                        price: '',
                        description: '',
                        category: '',
                        image: null,
                        food_image: null,
                        is_available: true,
                        meal_time: 'ANYTIME',
                        available_from: null,
                        available_to: null
                    });
                }}>
                    <Dialog.Title>{food.id ? 'Sửa món ăn' : 'Thêm món ăn mới'}</Dialog.Title>
                    <Dialog.Content style={{padding: 0}}>
                        <ScrollView 
                            style={{maxHeight: 400, paddingHorizontal: 24, paddingTop: 8}} 
                            contentContainerStyle={{paddingBottom: 16}}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={styles.imageContainer}>
                                {food.food_image ? (
                                    <Image 
                                        source={{ uri: food.food_image.uri }} 
                                        style={styles.foodImage} 
                                    />
                                ) : (
                                    <View style={styles.placeholderImage}>
                                        <Text>Chưa có ảnh</Text>
                                    </View>
                                )}
                                <Button 
                                    mode="contained" 
                                    onPress={pickImage}
                                    style={styles.imageButton}
                                >
                                    Chọn ảnh
                                </Button>
                            </View>

                            <TextInput
                                label="Tên món"
                                value={food.name}
                                onChangeText={text => setFood({...food, name: text})}
                                style={styles.input}
                            />
                            <TextInput
                                label="Giá"
                                value={food.price}
                                onChangeText={text => setFood({...food, price: text})}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                            <TextInput
                                label="Mô tả"
                                value={food.description}
                                onChangeText={text => setFood({...food, description: text})}
                                multiline
                                style={styles.input}
                            />
                            <TextInput
                                label="Danh mục"
                                value={food.category}
                                onChangeText={text => setFood({...food, category: text})}
                                style={styles.input}
                            />
                            
                            <Text style={styles.label}>Thời gian bán</Text>
                            <Picker
                                selectedValue={food.meal_time}
                                onValueChange={handleMealTimeChange}
                                style={styles.picker}
                            >
                                {MEAL_TIME_CHOICES.map(choice => (
                                    <Picker.Item 
                                        key={choice.value} 
                                        label={choice.label} 
                                        value={choice.value} 
                                    />
                                ))}
                            </Picker>

                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    label="Giờ bắt đầu"
                                    value={food.available_from || ''}
                                    onChangeText={text => handleTimeChange('available_from', text)}
                                    style={[styles.input, styles.timeInput]}
                                    placeholder="HH:mm"
                                />
                                <TextInput
                                    label="Giờ kết thúc"
                                    value={food.available_to || ''}
                                    onChangeText={text => handleTimeChange('available_to', text)}
                                    style={[styles.input, styles.timeInput]}
                                    placeholder="HH:mm"
                                />
                            </View>
                            <HelperText type="info">
                                {`${getMealTimeLabel(food.meal_time)}: ${MEAL_TIME_RANGES[food.meal_time].start} - ${MEAL_TIME_RANGES[food.meal_time].end}`}
                            </HelperText>

                            <View style={styles.switchContainer}>
                                <Text>Còn hàng</Text>
                                <Switch
                                    value={food.is_available}
                                    onValueChange={value => setFood({...food, is_available: value})}
                                />
                            </View>
                        </ScrollView>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setVisible(false)}>Hủy</Button>
                        <Button onPress={handleAddFood} loading={loading}>
                            {food.id ? 'Lưu' : 'Thêm'}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <FAB
                style={styles.fab}
                icon="plus"
                onPress={() => setVisible(true)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    menuButton: {
        marginLeft: 16,
    },
    foodCard: {
        marginBottom: 16,
    },
    input: {
        marginBottom: 12,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
    },
    picker: {
        marginBottom: 12,
    },
    timeInputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    timeInput: {
        flex: 1,
        marginHorizontal: 4,
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    foodInfo: {
        flexDirection: 'row',
        marginTop: 8,
        flexWrap: 'wrap',
    },
    chip: {
        marginRight: 8,
        marginBottom: 8,
    },
    timeRange: {
        marginTop: 8,
        color: '#666',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    foodImage: {
        width: 120,
        height: 120,
        borderRadius: 8,
        marginBottom: 8,
    },
    placeholderImage: {
        width: 120,
        height: 120,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    imageButton: {
        marginTop: 8,
    },
});

export default ManageFoods; 