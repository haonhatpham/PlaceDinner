import { Image, ScrollView, Text, TouchableOpacity, View, Alert, StyleSheet, FlatList } from "react-native"
import MyStyles from "../../styles/MyStyles"
import { Button, HelperText, TextInput, SegmentedButtons } from "react-native-paper";
import * as ImagePicker from 'expo-image-picker';
import { useContext, useState } from "react";
import Apis, { authApis, endpoints } from "../../configs/Apis";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MyDispatchContext } from "../../configs/Contexts";
// Không dùng các thư viện native gây lỗi
// import { GooglePlacesAutocomplete } from 'expo-google-places-autocomplete';
// import MapView, { Marker } from 'react-native-maps';

const GOOGLE_PLACES_API_KEY = 'AIzaSyDIIy38SH9YGf5A27UY1egi410B-jYoBFU'; // Thay thế bằng API key của bạn cho Web API
const GOOGLE_STATIC_MAPS_API_KEY = 'AIzaSyDIIy38SH9YGf5A27UY1egi410B-jYoBFU'; // Thay thế bằng API key của bạn cho Static Maps

const Register = () => {
    const nav = useNavigation();
    const dispatch = useContext(MyDispatchContext);

    // States cho form
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState();
    const [userType, setUserType] = useState('CUSTOMER');
    const [avatar, setAvatar] = useState(null);
    // Khởi tạo location với giá trị ban đầu không phải tọa độ hợp lệ
    const [location, setLocation] = useState({
        latitude: null,
        longitude: null,
    });

    // State cho địa chỉ nhập tay và gợi ý
    const [addressInput, setAddressInput] = useState(user.address || '');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

    // State cho địa chỉ đã chọn chính thức
    const [selectedAddress, setSelectedAddress] = useState(user.address || '');

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

    // Định nghĩa các trường thông tin cửa hàng (Địa chỉ sẽ được xử lý riêng)
    const storeInfoFields = [{
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

    // Hàm cập nhật state
    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }

    // Hàm hiển thị Alert
    const showAlert = (title, message, onOkPress) => {
        Alert.alert(title, message, [
            { text: "OK", onPress: onOkPress }
        ]);
    };

    // Hàm chọn ảnh
    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    // Hàm lấy gợi ý địa chỉ từ Google Places Autocomplete API (Web Service)
    const fetchAddressSuggestions = async (text) => {
        if (!text) {
            setAddressSuggestions([]);
            return;
        }
        setIsFetchingSuggestions(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&language=vi&components=country:vn&key=${GOOGLE_PLACES_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK') {
                setAddressSuggestions(data.predictions);
            } else {
                setAddressSuggestions([]);
                console.error('Lỗi khi lấy gợi ý địa chỉ:', data.status, data.error_message);
            }
        } catch (error) {
            console.error('Lỗi fetch gợi ý địa chỉ:', error);
            setAddressSuggestions([]);
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    // Hàm lấy chi tiết địa điểm từ Google Places Details API (Web Service)
    const fetchPlaceDetails = async (placeId) => {
        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&language=vi&key=${GOOGLE_PLACES_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK') {
                const { geometry, formatted_address } = data.result;
                setSelectedAddress(formatted_address);
                setLocation({
                    latitude: geometry.location.lat,
                    longitude: geometry.location.lng,
                });
                // Cập nhật địa chỉ vào state user cho form submit
                setState(formatted_address, 'address');
            } else {
                console.error('Lỗi khi lấy chi tiết địa điểm:', data.status, data.error_message);
                showAlert('Lỗi', 'Không thể lấy thông tin chi tiết địa điểm.');
            }
        } catch (error) {
            console.error('Lỗi fetch chi tiết địa điểm:', error);
            showAlert('Lỗi', 'Đã xảy ra lỗi khi lấy thông tin địa điểm.');
        }
    };

    // Hàm xử lý khi người dùng chọn một gợi ý địa chỉ
    const handleSuggestionPress = (suggestion) => {
        // Đặt giá trị input bằng địa chỉ được chọn
        setAddressInput(suggestion.description);
        // Xóa danh sách gợi ý
        setAddressSuggestions([]);
        // Lấy chi tiết địa điểm dựa trên place_id
        fetchPlaceDetails(suggestion.place_id);
    };

    // Hàm validate form
    const validate = () => {
        // Avatar bắt buộc cho tài khoản cửa hàng
        if (userType === 'STORE' && !avatar) {
            showAlert("Lỗi", "Vui lòng chọn ảnh đại diện cho cửa hàng!");
            return false;
        }

        // Kiểm tra các trường thông tin cơ bản bắt buộc
        for (let field of basicInfo) {
            if (field.required && !user[field.field]) {
                showAlert("Lỗi", `Vui lòng nhập ${field.label}!`);
                return false;
            }
        }

        // Kiểm tra mật khẩu khớp
        if (user.password !== user.confirm_password) {
            showAlert("Lỗi", "Mật khẩu xác nhận không khớp!");
            return false;
        }

        // Kiểm tra email hợp lệ
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
            showAlert("Lỗi", "Email không hợp lệ!");
            return false;
        }

        // Kiểm tra số điện thoại hợp lệ
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(user.phone_number)) {
            showAlert("Lỗi", "Số điện thoại không hợp lệ (phải có 10 chữ số)!");
            return false;
        }

        // Kiểm tra các trường thông tin cửa hàng nếu đăng ký là cửa hàng
        if (userType === 'STORE') {
            // Kiểm tra địa chỉ đã chọn và tọa độ
            if (!selectedAddress || location.latitude === null || location.longitude === null) {
                 showAlert("Lỗi", "Vui lòng chọn địa chỉ cửa hàng từ gợi ý!");
                 return false;
            }
            for (let field of storeInfoFields) {
                if (field.required && !user[field.field]) {
                    showAlert("Lỗi", `Vui lòng nhập ${field.label}!`);
                    return false;
                }
            }
        }
      
        return true;
    }

    // Hàm đăng ký
    const register = async () => {
        if (validate()) {
            try {
                setLoading(true);
                
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
                    formData.append('address', selectedAddress);
                    // Đảm bảo gửi string ngay cả khi giá trị là null
                    formData.append('latitude', location.latitude !== null ? location.latitude.toString() : '');
                    formData.append('longitude', location.longitude !== null ? location.longitude.toString() : '');
                    formData.append('description', user.description || '');
                    // Xử lý opening_hours có thể là object
                    formData.append('opening_hours', user.opening_hours ? (typeof user.opening_hours === 'object' ? JSON.stringify(user.opening_hours) : user.opening_hours) : '');
                }

                const response = await Apis.post(endpoints['register'], formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                
                if (userType === 'STORE') {
                    showAlert(
                        "Thành công", 
                        "Đăng ký thành công! Vui lòng chờ admin xác nhận tài khoản.",
                        () => nav.navigate('Đăng nhập')
                    );
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
                    showAlert("Lỗi", errorMsg);
                } else {
                    showAlert("Lỗi", "Đăng ký thất bại! Vui lòng thử lại sau.");
                }
                console.error('Lỗi đăng ký:', error);
            } finally {
                setLoading(false);
                console.log(formData);
            }
        }
        
    }

    // Tạo URL cho Google Static Map Image
    const staticMapImageUrl = location.latitude !== null && location.longitude !== null
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=15&size=400x200&markers=color:red%7C${location.latitude},${location.longitude}&key=${GOOGLE_STATIC_MAPS_API_KEY}`
        : null; // Hoặc một placeholder image URL

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
                    {/* TextInput cho Địa chỉ với gợi ý */}
                    <View style={MyStyles.m}>
                        <Text style={[MyStyles.label, { marginBottom: 10 }]}>
                            Địa chỉ cửa hàng *
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            mode="outlined"
                            placeholder="Nhập địa chỉ cửa hàng"
                            value={addressInput}
                            onChangeText={(text) => {
                                setAddressInput(text);
                                fetchAddressSuggestions(text); // Gọi API lấy gợi ý
                                setSelectedAddress(''); // Reset địa chỉ đã chọn khi người dùng gõ lại
                                setLocation({ latitude: null, longitude: null }); // Reset tọa độ
                            }}
                            right={<TextInput.Icon icon="map-marker" />}
                        />
                        
                        {/* Danh sách gợi ý địa chỉ */}
                        {addressSuggestions.length > 0 && (
                            <View style={styles.suggestionsContainer}>
                                <FlatList
                                    data={addressSuggestions}
                                    keyExtractor={(item) => item.place_id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity 
                                            style={styles.suggestionItem}
                                            onPress={() => handleSuggestionPress(item)}
                                        >
                                            <Text>{item.description}</Text>
                                        </TouchableOpacity>
                                    )}
                                    keyboardShouldPersistTaps='handled' // Giúp danh sách gợi ý không biến mất khi tap
                                />
                            </View>
                        )}
                    </View>

                    {/* Hiển thị thông tin vị trí đã chọn và bản đồ tĩnh */}
                    {(selectedAddress || (location.latitude !== null && location.longitude !== null)) ? (
                         <View style={[MyStyles.m, styles.locationInfoContainer]}>
                             <Text style={[MyStyles.label, { marginBottom: 10 }]}>
                                Thông tin vị trí và Bản đồ
                            </Text>
                             <View>
                                 <Text style={styles.locationText}>Địa chỉ: {selectedAddress || 'Đang cập nhật...'}</Text>
                                 {location.latitude !== null && location.longitude !== null && (
                                     <Text style={styles.locationText}>Tọa độ: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>
                                 )}
                                 
                                 {/* Hiển thị ảnh bản đồ tĩnh */}
                                 {staticMapImageUrl && (
                                     <Image 
                                         style={styles.staticMapImage}
                                         source={{ uri: staticMapImageUrl }}
                                         resizeMode="cover"
                                     />
                                 )}
                             </View>
                         </View>
                     ) : (
                        <View style={[MyStyles.m, styles.locationInfoContainer]}>
                             <Text style={styles.locationText}>Nhập địa chỉ để thấy gợi ý và bản đồ.</Text>
                         </View>
                     )}

                    {/* Form thông tin cửa hàng còn lại (Mô tả, Giờ mở cửa) */}
                    {storeInfoFields.map(field => (
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
        </ScrollView>
    );
}

// Thêm và cập nhật styles
const styles = StyleSheet.create({
    textInput: {
        // Styles cho TextInput địa chỉ
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
    },
    suggestionsContainer: {
        // Container cho danh sách gợi ý
        maxHeight: 200, // Giới hạn chiều cao danh sách gợi ý
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginTop: 5,
        backgroundColor: '#fff',
        // Cần zIndex để đảm bảo danh sách gợi ý hiển thị trên các element khác
        zIndex: 1000,
    },
    suggestionItem: {
        // Style cho mỗi mục gợi ý
        padding: 13,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    locationInfoContainer: {
        marginTop: 15, // Khoảng cách trên
        marginBottom: 15,
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        zIndex: 0, // Đảm bảo hiển thị dưới danh sách gợi ý
    },
    locationText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    staticMapImage: {
        width: '100%',
        height: 200, // Chiều cao của ảnh bản đồ
        borderRadius: 8,
        marginTop: 10,
    }
});

export default Register;
