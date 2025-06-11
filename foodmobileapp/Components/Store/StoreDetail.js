import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { Card, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { endpoints, authApi } from '../../configs/Apis';
import { MyUserContext } from '../../configs/Contexts';
import StoreReviewSection from './StoreReviewSection';
import DishDetail from "../Food/DishDetail";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

const StoreDetail = ({ route, navigation }) => {
    const { id, name } = route.params;
    const [store, setStore] = useState(null);
    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const user = useContext(MyUserContext);
    console.log("StoreDetail - User Data:", JSON.stringify(user, null, 2));

    useEffect(() => {
        console.log('StoreDetail - store object:', store);
        console.log('StoreDetail - user object:', user);
        loadStoreDetail();
        loadStoreFoods();
    }, [id, user]);

    const loadStoreDetail = async () => {
        try {
            setLoading(true);
            const response = await api.get(endpoints['store_detail'](id));
            setStore(response.data);
            setFollowersCount(response.data.followers_count || 0);
        } catch (err) {
            setError('Không thể tải thông tin cửa hàng');
        } finally {
            setLoading(false);
        }
    };


    const handleFollow = async () => {
        if (!user) {
            Alert.alert(
                'Thông báo',
                'Vui lòng đăng nhập để theo dõi cửa hàng',
                [
                    { text: 'Đăng nhập', onPress: () => navigation.navigate('Main', { screen: 'Đăng nhập' }) },
                    { text: 'Hủy', style: 'cancel' }
                ]
            );
            return;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            const response = await authApi(token).post(endpoints['store-follow'](id));
            
            setIsFollowing(response.data.is_following);
            setFollowersCount(response.data.followers_count);
            
            Alert.alert('Thông báo', response.data.status);
        } catch (err) {
            console.error('Follow Error:', err);
            Alert.alert('Lỗi', 'Không thể thực hiện thao tác này');
        }
    };

    const loadStoreFoods = async () => {
        try {
            const response = await api.get(endpoints['foods'], {
                params: {
                    store_id: id
                }
            });
            setFoods(response.data.results);
        } catch (err) {
            console.error('Store Foods Error:', err);
            Alert.alert('Lỗi', 'Không thể tải danh sách món ăn');
        }
    };

    const handleReviewAdded = () => {
        loadStoreDetail();
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.loadingText}>Đang tải thông tin cửa hàng...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="alert-circle" size={60} color="#c62828" />
                <Text style={styles.errorText}>{error}</Text>
                <Button 
                    mode="contained" 
                    onPress={() => navigation.goBack()}
                    style={styles.errorButton}
                >
                    Quay lại
                </Button>
            </View>
        );
    }

    if (!store) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="store-off" size={60} color="#c62828" />
                <Text style={styles.errorText}>Không tìm thấy thông tin cửa hàng</Text>
                <Button 
                    mode="contained" 
                    onPress={() => navigation.goBack()}
                    style={styles.errorButton}
                >
                    Quay lại
                </Button>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                {/* Ảnh cửa hàng */}
                <Image 
                    source={{ uri: store.avatar || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png' }} 
                    style={styles.storeImage} 
                />

                {/* Thông tin chính của cửa hàng */}
                <View style={styles.mainInfoContainer}>
                     <View style={styles.storeHeader}>
                        <Text style={styles.storeName}>{store.name}</Text>
                        <View style={styles.headerButtons}>
                            {user && (
                                <TouchableOpacity 
                                    style={styles.chatButton}
                                    onPress={() => {
                                        console.log("StoreDetail - Chat Button Pressed");
                                        console.log("StoreDetail - User:", user);
                                        console.log("StoreDetail - Store:", store);
                                        
                                        // Kiểm tra nếu người dùng là chủ cửa hàng và đang xem cửa hàng của chính mình
                                        if (user.role === 'Chủ cửa hàng' && user.store && user.store.id === store.id) {
                                            Alert.alert(
                                                'Thông báo',
                                                'Bạn không thể chat với chính cửa hàng của mình'
                                            );
                                            return;
                                        }

                                        if (user && user.id) {
                                            const userIdStr = user.id.toString();
                                            // Ưu tiên lấy store.user, fallback sang store.account
                                            let storeUserIdStr = '';
                                            if (store && store.user) {
                                                storeUserIdStr = store.user.toString();
                                            } else if (store && store.account) {
                                                storeUserIdStr = store.account.toString();
                                            } else {
                                                Alert.alert('Lỗi', 'Không tìm thấy userId của chủ cửa hàng!');
                                                return;
                                            }
                                            const sortedIds = [userIdStr, storeUserIdStr].sort();
                                            const roomId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
                                            console.log("StoreDetail - Starting new chat with params:", {
                                                storeUserId: storeUserIdStr,
                                                userId: userIdStr,
                                                storeName: store.name,
                                                storeAvatar: store.avatar,
                                                roomId: roomId
                                            });
                                            navigation.navigate('Main', {
                                                screen: 'ChatTab',
                                                params: {
                                                    screen: 'ChatScreen',
                                                    params: {
                                                        storeUserId: storeUserIdStr,
                                                        userId: userIdStr,
                                                        storeName: store.name,
                                                        storeAvatar: store.avatar,
                                                        isNewChat: true
                                                    }
                                                }
                                            });
                                        } else {
                                            Alert.alert(
                                                'Thông báo',
                                                'Vui lòng đăng nhập để sử dụng tính năng chat',
                                                [
                                                    { text: 'Đăng nhập', onPress: () => navigation.navigate('Main', { screen: 'Đăng nhập' }) },
                                                    { text: 'Hủy', style: 'cancel' }
                                                ]
                                            );
                                        }
                                    }}
                                >
                                    <Icon name="message-text" size={24} color="#2196F3" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                style={[styles.followButton, isFollowing && styles.followingButton]} 
                                onPress={handleFollow}
                            >
                                <Icon 
                                    name={isFollowing ? "heart" : "heart-outline"} 
                                    size={24} 
                                    color={isFollowing ? "#fff" : "#e74c3c"} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <View style={styles.statsContainer}>
                        {store.average_rating && (
                            <View style={styles.ratingContainer}>
                                <Icon name="star" size={20} color="#FFD700" />
                                <Text style={styles.ratingText}>{store.average_rating.toFixed(1)}</Text>
                                <Text style={styles.reviewCount}>({store.review_count || 0} đánh giá)</Text>
                            </View>
                        )}
                        <View style={styles.followersContainer}>
                            <Icon name="account-group" size={20} color="#666" />
                            <Text style={styles.followersCount}>{followersCount} người theo dõi</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <Icon name="map-marker" size={20} color="#666" />
                        <Text style={styles.address}>{store.address}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Icon name="clock-outline" size={20} color="#666" />
                        <Text style={styles.hours}>
                            Giờ mở cửa: {store.opening_hours?.start || '00:00'} - {store.opening_hours?.end || '23:59'}
                        </Text>
                    </View>
                </View>

                {/* Mô tả cửa hàng */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Text style={styles.sectionTitle}>Giới thiệu</Text>
                        <Text style={styles.description}>{store.description || 'Không có mô tả'}</Text>
                    </Card.Content>
                </Card>

                {/* Thêm Card hiển thị địa chỉ */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Text style={styles.sectionTitle}>Vị trí cửa hàng</Text>
                        {store.latitude && store.longitude ? (
                            <View style={{ height: 200, borderRadius: 10, overflow: 'hidden', marginVertical: 10 }}>
                                <MapView
                                    style={{ flex: 1 }}
                                    region={{
                                        latitude: parseFloat(store.latitude),
                                        longitude: parseFloat(store.longitude),
                                        latitudeDelta: 0.01,
                                        longitudeDelta: 0.01,
                                    }}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                >
                                    <Marker
                                        coordinate={{
                                            latitude: parseFloat(store.latitude),
                                            longitude: parseFloat(store.longitude)
                                        }}
                                        title={store.name}
                                    />
                                </MapView>
                            </View>
                        ) : (
                            <Text style={styles.noLocationText}>Không có thông tin vị trí</Text>
                        )}
                        {store.address ? (
                            <View style={styles.addressContainer}>
                                <Icon name="map-marker" size={20} color="#666" />
                                <Text style={styles.addressText}>{store.address}</Text>
                            </View>
                        ) : (
                            <Text style={styles.noLocationText}>Không có thông tin địa chỉ</Text>
                        )}
                    </Card.Content>
                </Card>

                {/* Danh sách món ăn */}
                <Card style={styles.sectionCard}>
                    <Card.Content>
                        <Text style={styles.sectionTitle}>Món ăn của cửa hàng</Text>
                        {foods && foods.length > 0 ? (
                            foods.map(food => {
                                return (
                                    <TouchableOpacity 
                                        key={food.id}
                                        style={styles.foodItem}
                                        onPress={() => navigation.navigate('DishDetail', { 
                                            id: food.id,
                                            name: food.name,
                                            storeId: id
                                        })}
                                    >
                                        <Image 
                                            source={{ uri: food.image || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-food.png' }} 
                                            style={styles.foodImage} 
                                        />
                                        <View style={styles.foodInfo}>
                                            <Text style={styles.foodName}>{food.name}</Text>
                                            <Text style={styles.foodPrice}>
                                                {parseFloat(food.price).toLocaleString('vi-VN')}đ
                                            </Text>
                                        </View>
                                        <Icon name="chevron-right" size={24} color="#666" />
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>Chưa có món ăn nào</Text>
                        )}
                    </Card.Content>
                </Card>

                {/* Phần đánh giá và bình luận */}
                <StoreReviewSection 
                    storeId={id} 
                    onReviewAdded={handleReviewAdded}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    storeImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    mainInfoContainer: {
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    storeName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 5,
        marginRight: 5,
    },
    reviewCount: {
        fontSize: 14,
        color: '#777',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    address: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
        flex: 1,
    },
    hours: {
        fontSize: 14,
        color: '#666',
        marginLeft: 8,
    },
    sectionCard: {
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: '#444',
    },
    foodItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    foodImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
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
        color: '#e74c3c',
        marginTop: 4,
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        marginVertical: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#c62828',
        textAlign: 'center',
        marginVertical: 20,
    },
    errorButton: {
        marginTop: 10,
        backgroundColor: '#2196F3',
    },
    storeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    followButton: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e74c3c',
        backgroundColor: '#fff',
    },
    followingButton: {
        backgroundColor: '#e74c3c',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    followersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    followersCount: {
        fontSize: 14,
        color: '#666',
        marginLeft: 5,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatButton: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2196F3',
        backgroundColor: '#fff',
        marginRight: 8,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    addressText: {
        fontSize: 16,
        color: '#444',
        marginLeft: 8,
        flex: 1,
    },
    noLocationText: {
        textAlign: 'center',
        color: '#666',
        marginTop: 10,
    },
});

export default StoreDetail; 