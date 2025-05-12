import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native"
import MyStyles from "../../styles/MyStyles"
import { Button, HelperText, TextInput } from "react-native-paper";
import * as ImagePicker from 'expo-image-picker';
import { useContext, useState } from "react";
import Apis, { authApis, endpoints } from "../../configs/Apis";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MyDispatchContext } from "../../configs/Contexts";

const Register = () => {
    const info = [{
        label: 'Tên đăng nhập',
        field: 'username',
        icon: 'account',
        secureTextEntry: false
    }, {
        label: 'Email',
        field: 'email',
        icon: 'email',
        secureTextEntry: false
    }, {
        label: 'Mật khẩu',
        field: 'password',
        icon: 'lock',
        secureTextEntry: true
    }, {
        label: 'Xác nhận mật khẩu',
        field: 'confirm_password',
        icon: 'lock-check',
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

        if (user.password !== user.confirm_password) {
            setMsg("Mật khẩu xác nhận không khớp!");
            return false;
        }

        setMsg('');
        return true;
    }

    const register = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
                let res = await Apis.post(endpoints['register'], {
                    username: user.username,
                    email: user.email,
                    password: user.password,
                    confirm_password: user.confirm_password
                });
                
                dispatch({
                    "type": "login",
                    "payload": res.data
                });
                
                nav.replace('HomeTab');
            } catch (ex) {
                if (ex.response && ex.response.data) {
                    let msg = '';
                    for (let key in ex.response.data) {
                        msg += `${key}: ${ex.response.data[key].join(', ')}\n`;
                    }
                    setMsg(msg);
                } else {
                    setMsg("Đăng ký thất bại, vui lòng kiểm tra lại!");
                }
                console.error(ex);
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

            <Button onPress={register} disabled={loading} loading={loading} style={MyStyles.m} mode="contained">Đăng ký</Button>
        </ScrollView>
    )
}

export default Register;
