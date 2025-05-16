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

const ManageFoods = () => {
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
        meal_time: 'ALL',
        selling_hours: {
            start: '00:00',
            end: '23:59'
        }
    });

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

    const handleAddFood = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const formData = new FormData();
            
            formData.append('name', food.name);
            formData.append('description', food.description);
            formData.append('price', food.price);
            formData.append('meal_time', food.meal_time === 'ALL' ? 'ANYTIME' : food.meal_time);
            formData.append('is_available', food.is_available);
            if (food.category) formData.append('category', food.category);
            if (food.food_image) formData.append('image', food.food_image);
            formData.append('available_from', food.selling_hours.start);
            formData.append('available_to', food.selling_hours.end);
            
            if (user && user.store) {
                formData.append('store', user.store.id);
            } else {
                Alert.alert('Lỗi', 'Không tìm thấy thông tin cửa hàng');
                return;
            }

            await authApi(token).post(endpoints['store-foods'], formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            setVisible(false);
            loadFoods();
        } catch (error) {
            if (error.response) {
                console.log('Lỗi thêm món:', error.response.data);
            } else {
                console.log('Lỗi thêm món:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAvailability = async (foodId, currentStatus) => {
        try {
            await authApi(token).patch(endpoints['food_detail'](foodId), {
                is_available: !currentStatus
            });
            loadFoods();
        } catch (error) {
            console.error('Lỗi cập nhật trạng thái:', error);
        }
    };

    const getMealTimeLabel = (mealTime) => {
        switch (mealTime) {
            case 'BREAKFAST': return 'Bữa sáng';
            case 'LUNCH': return 'Bữa trưa';
            case 'DINNER': return 'Bữa tối';
            case 'ALL': return 'Cả ngày';
            default: return 'Không xác định';
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView>
                <Text style={MyStyles.title}>Quản lý món ăn</Text>
                
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
                                <Text style={styles.timeRange}>
                                    Giờ bán: {food.selling_hours?.start} - {food.selling_hours?.end}
                                </Text>
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
                <Dialog visible={visible} onDismiss={() => setVisible(false)}>
                    <Dialog.Title>Thêm món ăn mới</Dialog.Title>
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
                                onValueChange={(value) => setFood({...food, meal_time: value})}
                                style={styles.picker}
                            >
                                <Picker.Item label="Cả ngày" value="ALL" />
                                <Picker.Item label="Bữa sáng" value="BREAKFAST" />
                                <Picker.Item label="Bữa trưa" value="LUNCH" />
                                <Picker.Item label="Bữa tối" value="DINNER" />
                            </Picker>

                            <View style={styles.timeInputContainer}>
                                <TextInput
                                    label="Giờ bắt đầu"
                                    value={food.selling_hours.start}
                                    onChangeText={text => setFood({
                                        ...food,
                                        selling_hours: {...food.selling_hours, start: text}
                                    })}
                                    style={[styles.input, styles.timeInput]}
                                    placeholder="HH:mm"
                                />
                                <TextInput
                                    label="Giờ kết thúc"
                                    value={food.selling_hours.end}
                                    onChangeText={text => setFood({
                                        ...food,
                                        selling_hours: {...food.selling_hours, end: text}
                                    })}
                                    style={[styles.input, styles.timeInput]}
                                    placeholder="HH:mm"
                                />
                            </View>

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
                        <Button onPress={handleAddFood} loading={loading}>Thêm</Button>
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