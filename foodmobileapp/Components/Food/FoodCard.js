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
const cardWidth = (width - 30) / 2; // 2 cột, padding 10 mỗi bên

const FoodCard = ({ food, onPress }) => {
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
                    {food.price.toLocaleString('vi-VN')}đ
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
    },
    image: {
        width: '100%',
        height: cardWidth * 0.75, // Tỷ lệ 4:3
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    infoContainer: {
        padding: 10,
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