
import React, { useState, useEffect } from 'react';
import { useContext } from "react";
import { Text, View, ScrollView } from "react-native";
import { MyDispatchContext, MyUserContext } from "../../configs/Contexts";
import MyStyles from "../../styles/MyStyles";
import { Button, Card, Divider } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { authApi, endpoints } from "../../configs/Apis";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "react-native";



const Profile = () => {
    const user = useContext(MyUserContext);

    const dispatch = useContext(MyDispatchContext);
    const nav = useNavigation();

    const [followingStores, setFollowingStores] = useState([]);

    useFocusEffect(
        useCallback(() => {
            const fetchFollowingStores = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (!token) {
                        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại');
                        return;
                    }
                    const res = await authApi(token).get(endpoints['store-following']);
                    setFollowingStores(res.data);
                } catch (err) {
                    console.error("Lỗi lấy danh sách cửa hàng đang theo dõi:", err);
                }
            };
            if (user?.role === "Khách hàng") {
                fetchFollowingStores();
            }
        }, [user])
    );

    console.log("Profile User Data:", JSON.stringify(user, null, 2));

    const logout = async () => {
        try {
            // Xóa token và refresh token
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('refresh_token');
            
            // Dispatch action logout
            dispatch({
                "type": "logout"
            });

            // Chuyển về trang đăng nhập
            nav.navigate("Đăng nhập");
        } catch (error) {
            console.error("Lỗi đăng xuất:", error);
        }
    }

    return (
        <ScrollView style={MyStyles.container}>
            <View style={MyStyles.m}>
                <Text style={MyStyles.title}>Thông tin tài khoản</Text>
                {/* Thông tin cá nhân */}
                <Card style={[MyStyles.m, { marginTop: 10 }]}>
                    <Card.Title title="Thông tin cá nhân" />
                    <Card.Content>
                        <Text style={MyStyles.text}>Họ và tên: {user?.last_name} {user?.first_name}</Text>
                        <Text style={MyStyles.text}>Email: {user?.email}</Text>
                        <Text style={MyStyles.text}>Số điện thoại: {user?.phone_number}</Text>
                        <Text style={MyStyles.text}>Loại tài khoản: {user?.role === 'Chủ cửa hàng' ? 'Cửa hàng' : 'Khách hàng'}</Text>
                    </Card.Content>
                </Card>

                {/* Thông tin cửa hàng - chỉ hiển thị nếu là tài khoản cửa hàng */}
                {user?.role === 'Chủ cửa hàng' && user?.store && (
                    <Card style={[MyStyles.m, { marginTop: 10 }]}>
                        <Card.Title title="Thông tin cửa hàng" />
                        <Card.Content>
                            <Text style={MyStyles.text}>Tên cửa hàng: {user.store.name}</Text>
                            <Text style={MyStyles.text}>Địa chỉ: {user.store.address}</Text>
                            <Text style={MyStyles.text}>Giờ mở cửa: {user.store.opening_hours}</Text>
                            <Divider style={{ marginVertical: 10 }} />
                            <Button 
                                mode="contained"
                                icon="chart-bar"
                                onPress={() => nav.navigate('RevenueStats', {
                                    storeId: user.store.id
                                })}
                                style={{ marginTop: 10 }}
                            >
                                Xem thống kê doanh thu
                            </Button>
                        </Card.Content>
                    </Card>
                )}

                {/* Nút đăng xuất */}
                <Card style={[MyStyles.m, { marginTop: 10 }]}>
                    <Card.Content>
                        <Button 
                            mode="contained"
                            icon="logout"
                            onPress={logout}
                            style={{ backgroundColor: '#ff4444' }}
                        >
                            Đăng xuất
                        </Button>
                    </Card.Content>
                </Card>

                {user?.role === "Khách hàng" && (
                    <Card style={[MyStyles.m, { marginTop: 10 }]}>
                        <Card.Title title="Cửa hàng đang theo dõi" />
                        <Card.Content>
                            {followingStores.length === 0 ? (
                                <Text style={MyStyles.text}>Bạn chưa theo dõi cửa hàng nào.</Text>
                            ) : (
                                followingStores.map(store => (
                                    <View key={store.id} style={{ marginBottom: 10 }}>
                                        <Text style={MyStyles.text}>Tên: {store.name}</Text>
                                        <Text style={MyStyles.text}>Địa chỉ: {store.address}</Text>
                                        <Button
                                            mode="outlined"
                                            onPress={() => nav.navigate('StoreDetail', { id: store.id, name: store.name })}
                                            style={{ marginTop: 5 }}
                                        >
                                            Xem chi tiết
                                        </Button>
                                        <Divider style={{ marginVertical: 5 }} />
                                    </View>
                                ))
                            )}
                        </Card.Content>
                    </Card>
                )}
            </View>
        </ScrollView>
    );
}

export default Profile;