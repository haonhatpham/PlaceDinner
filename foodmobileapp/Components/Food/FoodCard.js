import React from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const cardWidth = (width - 20);

// Hàm helper để định dạng giá tiền sang VND
const formatPriceVND = (price) => {
    // Đảm bảo giá trị là số và là số hợp lệ
    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber)) {
        return 'N/A'; // Hoặc một chuỗi báo lỗi khác
    }

    // Định dạng số với dấu chấm phân cách hàng nghìn
    // Sử dụng toFixed(0) để loại bỏ phần thập phân nếu luôn là .00
    const formattedPrice = priceNumber.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formattedPrice}₫`;
};

const FoodCard = ({ food, onPress }) => {

    // Thêm log để kiểm tra kiểu dữ liệu và giá trị của food.price
    console.log('FoodCard - Price Data:', { type: typeof food.price, value: food.price });

    // Sử dụng hàm định dạng tùy chỉnh
    const displayPrice = formatPriceVND(food.price);

    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <Image
                source={{ uri: food.image }}
                style={styles.image}
                resizeMode="cover"
            />
            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>
                    {food.name}
                </Text>
                <Text style={styles.price}>
                    {/* Sử dụng giá trị đã được định dạng bởi hàm helper */}
                    {displayPrice}
                </Text>
                <View style={styles.storeContainer}>
                    <Ionicons name="restaurant-outline" size={14} color="#666" />
                    <Text style={styles.storeName} numberOfLines={1}>
                        {food.store_name}
                    </Text>
                </View>
                <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.rating}>
                        {food.average_rating?.toFixed(1) || 'Chưa có đánh giá'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: cardWidth,
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        overflow: 'hidden',
    },
    image: {
        width: 100,
        height: 100,
    },
    infoContainer: {
        flex: 1,
        padding: 10,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    price: {
        fontSize: 15,
        color: '#e74c3c',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    storeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    storeName: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
        flex: 1,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rating: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
    },
});

export default FoodCard; 