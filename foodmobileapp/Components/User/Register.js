import { Image, ScrollView, Text, TouchableOpacity, View, LogBox } from "react-native"
import MyStyles from "../../styles/MyStyles"
import { Button, HelperText, TextInput, SegmentedButtons } from "react-native-paper";
import * as ImagePicker from 'expo-image-picker';
import { useContext, useState, useEffect } from "react";
import Apis, { authApis, endpoints } from "../../configs/Apis";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MyDispatchContext } from "../../configs/Contexts";
import MapView, { Marker } from 'react-native-maps';

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested', // Ẩn cảnh báo này
]);

const Register = () => {
    const nav = useNavigation();
    const dispatch = useContext(MyDispatchContext);

    // States cho form
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState();
    const [userType, setUserType] = useState('CUSTOMER');
    const [avatar, setAvatar] = useState(null);
    const [location, setLocation] = useState({
        latitude: 10.7769,
        longitude: 106.7009,
    });
    // Tách riêng state cho address
    const [address, setAddress] = useState('');
    const [suggestions, setSuggestions] = useState([]);

    // Định nghĩa các trường thông tin cơ bản
    const basicInfo = [{
        label: 'Tên đăng nhập',
        field: 'username',
        icon: 'account',
        secureTextEntry: false,
        required: true
    }, {
        label: 'Email',
        field: 'email',
        icon: 'email',
        secureTextEntry: false,
        required: true
    }, {
        label: 'Mật khẩu',
        field: 'password',
        icon: 'lock',
        secureTextEntry: true,
        required: true
    }, {
        label: 'Xác nhận mật khẩu',
        field: 'confirm_password',
        icon: 'lock-check',
        secureTextEntry: true,
        required: true
    }, {
        label: 'Họ',
        field: 'last_name',
        icon: 'account',
        secureTextEntry: false,
        required: false
    }, {
        label: 'Tên',
        field: 'first_name',
        icon: 'account',
        secureTextEntry: false,
        required: false
    }, {
        label: 'Số điện thoại',
        field: 'phone_number',
        icon: 'phone',
        secureTextEntry: false,
        required: true
    }];

    // Định nghĩa các trường thông tin cửa hàng
    const storeInfo = [{
        label: 'Địa chỉ',
        field: 'address',
        icon: 'map-marker',
        secureTextEntry: false,
        required: true
    }, {
        label: 'Mô tả cửa hàng',
        field: 'description',
        icon: 'information',
        secureTextEntry: false,
        multiline: true,
        required: true
    }, {
        label: 'Giờ mở cửa',
        field: 'opening_hours',
        icon: 'clock',
        secureTextEntry: false,
        placeholder: 'VD: 8:00 - 22:00',
        required: true
    }];

    // useEffect để tự động lấy tọa độ khi address thay đổi (chỉ khi là STORE)
    useEffect(() => {
        const fetchCoords = async () => {
            if (userType === 'STORE' && address && address.length > 5) {
                setMsg('Đang tìm vị trí trên bản đồ...');
                const coords = await getCoordinates(address);
                console.log('Kết quả Nominatim:', coords);
                if (coords) {
                    setLocation({ ...coords }); // luôn tạo object mới
                    setMsg('');
                } else {
                    setMsg('Không tìm thấy vị trí phù hợp với địa chỉ này!');
                }
            }
        };
        fetchCoords();
    }, [address, userType]);

    // Thêm hàm lấy tọa độ từ địa chỉ bằng Mapbox Geocoding API
    const getCoordinates = async (address) => {
        const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2hqbWpuaDNtIiwiYSI6ImNtYnNhaGNzYjBqbW0ya3B3cWM1NzByZTkifQ.9n1wP5AngOmQTU3DzZB7aw';
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=vi`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log('Kết quả Mapbox:', data);
            if (data && data.features && data.features.length > 0) {
                return {
                    latitude: data.features[0].center[1],
                    longitude: data.features[0].center[0]
                };
            }
        } catch (e) {
            console.log('Lỗi khi gọi Mapbox:', e);
        }
        return null;
    };

    // Hàm cập nhật state
    const setState = (value, field) => {
        setUser({ ...user, [field]: value });
        // Nếu là trường địa chỉ thì cập nhật state address
        if (userType === 'STORE' && field === 'address') {
            setAddress(value);
        }
    }

    // Hàm chọn ảnh
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
            setMsg('Cần cấp quyền truy cập thư viện ảnh!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    // Hàm validate form
    const validate = () => {
        // Avatar bắt buộc cho tài khoản cửa hàng
        if (userType === 'STORE' && !avatar) {
            setMsg("Vui lòng chọn ảnh đại diện cho cửa hàng!");
            return false;
        }

        // Kiểm tra các trường thông tin cơ bản bắt buộc
        for (let field of basicInfo) {
            if (field.required && !user[field.field]) {
                setMsg(`Vui lòng nhập ${field.label}!`);
                return false;
            }
        }

        // Kiểm tra mật khẩu khớp
        if (user.password !== user.confirm_password) {
            setMsg("Mật khẩu xác nhận không khớp!");
            return false;
        }

        // Kiểm tra email hợp lệ
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
            setMsg("Email không hợp lệ!");
            return false;
        }

        // Kiểm tra số điện thoại hợp lệ
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(user.phone_number)) {
            setMsg("Số điện thoại không hợp lệ (phải có 10 chữ số)!");
            return false;
        }

        // Kiểm tra các trường thông tin cửa hàng nếu đăng ký là cửa hàng
        if (userType === 'STORE') {
            for (let field of storeInfo) {
                if (field.required && !user[field.field]) {
                    setMsg(`Vui lòng nhập ${field.label}!`);
                    return false;
                }
            }
        }
      
        setMsg('');
        return true;
    }

    // Hàm đăng ký
    const register = async () => {
        if (validate()) {
            try {
                setLoading(true);
                
                // // Log dữ liệu người dùng nhập
                // console.log("=== FORM DATA ===");
                // console.log("User Info:", user);
                // console.log("User Type:", userType);
                // console.log("Avatar:", avatar);
                // console.log("Location:", location);
                
                const formData = new FormData();
                
                // Thêm thông tin cơ bản
                formData.append('username', user.username);
                formData.append('email', user.email);
                formData.append('password', user.password);
                formData.append('first_name', user.first_name || '');
                formData.append('last_name', user.last_name || '');
                formData.append('phone_number', user.phone_number);
                formData.append('role', userType);

                // Thêm avatar nếu có
                if (avatar) {
                    const avatarName = avatar.split('/').pop();
                    const match = /\.(\w+)$/.exec(avatarName);
                    const type = match ? `image/${match[1]}` : 'image';
                    formData.append('avatar', {
                        uri: avatar,
                        name: avatarName,
                        type,
                    });
                }

                // Thêm thông tin cửa hàng nếu đăng ký là cửa hàng
                if (userType === 'STORE') {
                    formData.append('address', address);
                    formData.append('description', user.description);
                    formData.append('opening_hours', user.opening_hours);
                    formData.append('latitude', location.latitude.toString());
                    formData.append('longitude', location.longitude.toString());
                }

                const response = await Apis.post(endpoints['register'], formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                
                if (userType === 'STORE') {
                    setMsg("Đăng ký thành công! Vui lòng chờ admin xác nhận tài khoản.");
                    setTimeout(() => nav.navigate('Đăng nhập'), 2000);
                } else {
                    dispatch({
                        "type": "login",
                        "payload": response.data
                    });
                    nav.navigate('Trang chủ');
                }
            } catch (error) {
                if (error.response?.data) {
                    let errorMsg = '';
                    for (let key in error.response.data) {
                        errorMsg += `${key}: ${error.response.data[key].join(', ')}\n`;
                    }
                    setMsg(errorMsg);
                } else {
                    setMsg("Đăng ký thất bại! Vui lòng thử lại sau.");
                }
                console.error('Lỗi đăng ký:', error);
            } finally {
                setLoading(false);
                console.log(formData);
            }
        }
        
    }

    // Hàm lấy gợi ý địa chỉ từ Mapbox
    const fetchSuggestions = async (query) => {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }
        const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2hqbWpuaDNtIiwiYSI6ImNtYnNhaGNzYjBqbW0ya3B3cWM1NzByZTkifQ.9n1wP5AngOmQTU3DzZB7aw';
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&language=vi`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.features) {
                setSuggestions(data.features);
            }
        } catch (e) {
            setSuggestions([]);
        }
    };

    return (
        <ScrollView style={MyStyles.container}>
            <View style={MyStyles.m}>
                <Text style={MyStyles.title}>Đăng Ký Tài Khoản</Text>
            </View>

            

            {/* Chọn loại tài khoản */}
            <SegmentedButtons
                value={userType}
                onValueChange={setUserType}
                buttons={[
                    { value: 'CUSTOMER', label: 'Cá nhân' },
                    { value: 'STORE', label: 'Cửa hàng' }
                ]}
                style={MyStyles.m}
            />
            
            {/* Chọn avatar */}
            <TouchableOpacity onPress={pickImage} style={[MyStyles.m, MyStyles.center]}>
                {avatar ? (
                    <Image 
                        source={{ uri: avatar }} 
                        style={[MyStyles.avatar, { width: 120, height: 120 }]} 
                    />
                ) : (
                    <View style={[MyStyles.center, { 
                        width: 120, 
                        height: 120, 
                        borderRadius: 60,
                        backgroundColor: '#f0f0f0',
                        borderWidth: 1,
                        borderColor: '#ddd'
                    }]}>
                        <Text>{userType === 'STORE' ? 'Chọn logo cửa hàng*' : 'Chọn ảnh đại diện'}</Text>
                    </View>
                )}
            </TouchableOpacity>
             {/* Chú thích trường bắt buộc */}
             <Text style={[MyStyles.m, { textAlign: 'center', color: '#666' }]}>
                * Trường bắt buộc
            </Text>
            {/* Form thông tin cơ bản */}
            {basicInfo.map(field => (
                <TextInput 
                    key={field.field}
                    style={MyStyles.m}
                    mode="outlined"
                    label={field.label + (field.required ? ' *' : '')}
                    value={user[field.field] || ''}
                    onChangeText={text => setState(text, field.field)}
                    secureTextEntry={field.secureTextEntry}
                    right={<TextInput.Icon icon={field.icon} />}
                />
            ))}

            {/* Form thông tin cửa hàng */}
            {userType === 'STORE' && (
                <>
                    {/* Địa chỉ với autocomplete đẹp */}
                    <View style={{ position: 'relative', zIndex: 20 }}>
                        <TextInput
                            mode="outlined"
                            label="Địa chỉ *"
                            value={address}
                            onChangeText={text => {
                                setAddress(text);
                                setState(text, 'address');
                                fetchSuggestions(text);
                            }}
                            right={<TextInput.Icon icon="map-marker" />}
                            style={MyStyles.m}
                        />
                        {suggestions.length > 0 && (
                            <View style={{
                                position: 'absolute',
                                top: 60,
                                left: 0,
                                right: 0,
                                backgroundColor: 'white',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#ccc',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                                elevation: 5,
                                maxHeight: 180,
                                zIndex: 100,
                            }}>
                                {suggestions.map(item => (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => {
                                            setAddress(item.place_name);
                                            setState(item.place_name, 'address');
                                            setSuggestions([]);
                                            setLocation({
                                                latitude: item.center[1],
                                                longitude: item.center[0]
                                            });
                                        }}
                                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                                    >
                                        <Text style={{ color: '#333' }}>{item.place_name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                    {/* Các trường còn lại */}
                    {storeInfo.filter(field => field.field !== 'address').map(field => (
                        <TextInput 
                            key={field.field}
                            style={MyStyles.m}
                            mode="outlined"
                            label={field.label + ' *'}
                            value={user[field.field] || ''}
                            onChangeText={text => setState(text, field.field)}
                            multiline={field.multiline}
                            numberOfLines={field.multiline ? 3 : 1}
                            placeholder={field.placeholder}
                            right={<TextInput.Icon icon={field.icon} />}
                        />
                    ))}

                    {/* Bản đồ chọn vị trí */}
                    <View style={MyStyles.m}>
                        <Text style={[MyStyles.label, { marginBottom: 10 }]}>Chọn vị trí cửa hàng *</Text>
                        <MapView
                            style={{ height: 200, borderRadius: 8 }}
                            region={{
                                latitude: location.latitude,
                                longitude: location.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            onPress={(e) => setLocation({ ...e.nativeEvent.coordinate })}
                        >
                            <Marker
                                coordinate={location}
                                title="Vị trí cửa hàng"
                                draggable
                                onDragEnd={e => setLocation({ ...e.nativeEvent.coordinate })}
                            />
                        </MapView>
                        {/* Hiển thị thông báo lỗi/thành công liên quan đến map */}
                        {msg && (
                            <HelperText type="error" visible={true} style={MyStyles.m}>
                                {msg}
                            </HelperText>
                        )}
                    </View>
                </>
            )}

            {/* Nút đăng ký */}
            <Button 
                mode="contained"
                onPress={register}
                loading={loading}
                disabled={loading}
                style={[MyStyles.m, { marginTop: 20 }]}
            >
                {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </Button>

            {/* Link đăng nhập */}
            <TouchableOpacity 
                onPress={() => nav.navigate('Đăng nhập')}
                style={[MyStyles.m, { marginBottom: 30 }]}
            >
                <Text style={MyStyles.link}>
                    Đã có tài khoản? Đăng nhập ngay
                </Text>
            </TouchableOpacity>
            {/* Hiển thị thông báo lỗi/thành công */}
            {msg && (
                <HelperText type="error" visible={true} style={MyStyles.m}>
                    {msg}
                </HelperText>
            )}
          
        </ScrollView>
    );
}

export default Register;