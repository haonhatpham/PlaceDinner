import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, TextInput } from 'react-native-paper';
import { Rating } from 'react-native-ratings';
import { MyUserContext } from '../../configs/Contexts';
import { authApi, endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ReviewSection = ({ foodId, onReviewAdded }) => {
    const user = useContext(MyUserContext);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newReview, setNewReview] = useState({
        rating: 0,
        comment: '',
        store: null
    });

    useEffect(() => {
        loadReviews();
    }, [foodId]);

    const loadReviews = async () => {
        try {
            const response = await authApi().get(endpoints['food_detail'](foodId) + 'reviews/');
            console.log("Review mon an:" ,response.data);
            setReviews(response.data);
        } catch (error) {
            console.error('Lỗi tải đánh giá:', error);
        }
    };

    const handleAddReview = async () => {
        if (!user) {
            Alert.alert('Thông báo', 'Vui lòng đăng nhập để đánh giá');
            return;
        }

        if (newReview.rating === 0) {
            Alert.alert('Thông báo', 'Vui lòng chọn số sao');
            return;
        }

        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            
            // Lấy thông tin món ăn để có store_id
            const foodResponse = await authApi().get(endpoints['food_detail'](foodId));
            const foodData = foodResponse.data;
            
            // Tạo dữ liệu đánh giá với store_id
            const reviewData = {
                ...newReview,
                store: foodData.store?.id
            };
            
            console.log('Dữ liệu đánh giá:', reviewData);
            
            const response = await authApi(token).post(endpoints['food_detail'](foodId) + 'reviews/', reviewData);
            
            // Reset form và tải lại danh sách đánh giá
            setNewReview({ rating: 0, comment: '', store: null });
            loadReviews();
            if (onReviewAdded) {
                onReviewAdded();
            }
        } catch (error) {
            console.error('Chi tiết lỗi:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });

            // Cải thiện xử lý lỗi để hiển thị thông báo thân thiện hơn
            let errorMessage = 'Không thể thêm đánh giá';
            if (error.response && error.response.data) {
                if (error.response.data.comment && error.response.data.comment.includes('This field may not be blank.')) {
                    errorMessage = 'Vui lòng nhập bình luận cho đánh giá.';
                } else if (error.response.data.error) {
                    errorMessage = error.response.data.error;
                } else if (error.message) {
                    errorMessage = `Lỗi: ${error.message}`;
                }
            }

            Alert.alert('Lỗi', errorMessage);

        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Đánh giá và bình luận</Text>
            
            {/* Form thêm đánh giá mới */}
            {user ? (
                <Card style={styles.reviewForm}>
                    <Card.Content>
                        <Text style={styles.formTitle}>Thêm đánh giá của bạn</Text>
                        <Rating
                            showRating
                            onFinishRating={(value) => setNewReview({...newReview, rating: value})}
                            style={styles.rating}
                            startingValue={newReview.rating}
                        />
                        <TextInput
                            label="Bình luận của bạn"
                            value={newReview.comment}
                            onChangeText={(text) => setNewReview({...newReview, comment: text})}
                            multiline
                            numberOfLines={3}
                            style={styles.commentInput}
                        />
                        <Button 
                            mode="contained" 
                            onPress={handleAddReview}
                            loading={loading}
                            style={styles.submitButton}
                        >
                            Gửi đánh giá
                        </Button>
                    </Card.Content>
                </Card>
            ) : (
                <Card style={styles.reviewForm}>
                    <Card.Content>
                        <Text style={styles.loginMessage}>Bạn cần đăng nhập để đánh giá</Text>
                    </Card.Content>
                </Card>
            )}

            {/* Danh sách đánh giá */}
            <ScrollView style={styles.reviewsList}>
                {reviews && reviews.length > 0 ? (
                    reviews.map((review) => (
                        <Card key={review.id} style={styles.reviewCard}>
                            <Card.Content>
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewerName}>{review.customer_name}</Text>
                                    <Rating
                                        readonly
                                        startingValue={review.rating}
                                        imageSize={20}
                                        style={styles.rating}
                                    />
                                </View>
                                <Text style={styles.reviewComment}>{review.comment}</Text>
                                <Text style={styles.reviewDate}>
                                    {new Date(review.created_date).toLocaleDateString('vi-VN')}
                                </Text>
                            </Card.Content>
                        </Card>
                    ))
                ) : (
                    <Card style={styles.reviewCard}>
                        <Card.Content>
                            <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
                        </Card.Content>
                    </Card>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    reviewForm: {
        marginBottom: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    rating: {
        marginBottom: 8,
    },
    commentInput: {
        marginBottom: 8,
    },
    submitButton: {
        marginTop: 8,
    },
    reviewsList: {
        flex: 1,
    },
    reviewCard: {
        marginBottom: 8,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewerName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    reviewComment: {
        fontSize: 14,
        marginBottom: 8,
    },
    reviewDate: {
        fontSize: 12,
        color: '#666',
    },
    loginMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginVertical: 10,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginVertical: 10,
    },
});

export default ReviewSection; 