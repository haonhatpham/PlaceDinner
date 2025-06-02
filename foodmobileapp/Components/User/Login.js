import React, { useState, useEffect, useContext } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native"
import MyStyles from "../../styles/MyStyles"
import { Button, HelperText, TextInput } from "react-native-paper";
import * as ImagePicker from 'expo-image-picker';
import api, { authApi, endpoints } from "../../configs/Apis";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MyDispatchContext } from "../../configs/Contexts";

const Login = () => {
    const info = [{
        label: 'Tên đăng nhập',
        field: 'username',
        icon: 'account',
        secureTextEntry: false
    }, {
        label: 'Mật khẩu',
        field: 'password',
        icon: 'eye',
        secureTextEntry: true
    }];

    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState();
    const nav = useNavigation();
    const dispatch = useContext(MyDispatchContext);

    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }

    const validate = () => {
        if (Object.values(user).length == 0) {
            setMsg("Vui lòng nhập thông tin!");
            return false;
        }

        for (let i of info)
            if (user[i.field] === '') {
                setMsg(`Vui lòng nhập ${i.label}!`);
                return false;
            }

        setMsg('');
        return true;
    }

    const login = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
                setMsg('');
                
                const loginData = {
                    username: user.username,
                    password: user.password,
                    client_id: '9tlx4eMbkTHpH7SJrJdgr2kmkn8UtcCTuQNx1yiX',
                    client_secret: 'Pq2u9U7URcJd27LTMU5bCJ12mDk7HjZ0ztxYU2sSVGxGn8J68nOQwAjXyHsinNdqTuULlfvN3XCeoCDkgGeDLBeCWtrBX0vwHDL442HkfdfVUr6e80EsZUIqhGtWJa6R',
                    grant_type: 'password'
                };
                

                // Gọi API đăng nhập
                const res = await api.post(endpoints['login'], loginData);

                // Lưu token
                await AsyncStorage.setItem('token', res.data.access_token);
                if (res.data.refresh_token) {
                    await AsyncStorage.setItem('refresh_token', res.data.refresh_token);
                }

                // Lấy thông tin user
                const userRes = await authApi(res.data.access_token).get(endpoints['current-user']);
                console.log("Login - User Data from API:", JSON.stringify(userRes.data, null, 2));
                
                // Cập nhật state và chuyển hướng
                dispatch({
                    "type": "login",
                    "payload": userRes.data
                });
                
                nav.navigate('Trang chủ');
            } catch (ex) {
                console.error(ex);
                if (ex.response) {
                    if (ex.response.status === 401) {
                        setMsg('Tên đăng nhập hoặc mật khẩu không đúng!');
                    } else if (ex.response.data) {
                        setMsg(ex.response.data.detail || 'Đăng nhập thất bại!');
                    }
                } else {
                    setMsg('Không thể kết nối đến máy chủ!');
                }
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <ScrollView>
            <HelperText type="error" visible={msg}>
                {msg}
            </HelperText>
            
            {info.map(i =>  <TextInput key={i.field} style={MyStyles.m}
                                label={i.label}
                                secureTextEntry={i.secureTextEntry}
                                right={<TextInput.Icon icon={i.icon} />}
                                value={user[i.field]} onChangeText={t => setState(t, i.field)} />)}

            <Button onPress={login} disabled={loading} loading={loading} style={MyStyles.m} mode="contained">Đăng nhập</Button>
        </ScrollView>
    )
}

export default Login;