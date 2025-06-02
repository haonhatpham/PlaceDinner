import React, { useState, useEffect, useContext } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar, Divider } from 'react-native-paper';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../configs/FirebaseConfig';
import { MyUserContext } from '../../configs/Contexts';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api, { endpoints } from '../../configs/Apis';

const ChatListScreen = ({ navigation }) => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = useContext(MyUserContext);

    useEffect(() => {
        let unsubscribe = () => {};

        const setupChatListener = async () => {
            if (!user || !user.id) {
                setLoading(false);
                return;
            }

            try {
                console.log("ChatListScreen - Setting up chat listener for user:", user);
                const userIdStr = user.id.toString();
                console.log("ChatListScreen - User ID string:", userIdStr);
                console.log("ChatListScreen - User role:", user.role);

                // Xác định ID để tìm kiếm phòng chat
                let searchId = userIdStr;
                if (user.role === 'Chủ cửa hàng' && user.store) {
                    // Nếu là cửa hàng, sử dụng store.id để tìm kiếm
                    searchId = user.store.id.toString();
                    console.log("ChatListScreen - Using store ID for search:", searchId);
                }

                // Query để lấy tất cả các cuộc trò chuyện
                const q = query(
                    collection(db, "chats"),
                    where("participants", "array-contains", searchId),
                    orderBy("lastMessageTime", "desc")
                );

                unsubscribe = onSnapshot(q, 
                    async (snapshot) => {
                        console.log("ChatListScreen - Received chats update, count:", snapshot.docs.length);
                        const chatList = await Promise.all(snapshot.docs.map(async doc => {
                            const data = doc.data();
                            console.log("ChatListScreen - Processing chat doc ID:", doc.id, "data:", data);
                            
                            // Đảm bảo participants là array của string
                            const participants = data.participants.map(id => id.toString());
                            console.log("ChatListScreen - Participants:", participants);
                            
                            // Xác định người tham gia khác
                            const otherParticipantId = participants.find(id => id !== searchId);
                            console.log("ChatListScreen - Other participant ID:", otherParticipantId);

                            // Xác định tên hiển thị và avatar dựa trên vai trò và người tham gia khác
                            let displayName, displayAvatar;
                            const isStore = user.role === 'Chủ cửa hàng';

                            if (isStore) {
                                // Nếu là cửa hàng, hiển thị thông tin khách hàng
                                // Lấy tên và avatar khách hàng từ dữ liệu chat room
                                // Sử dụng toán tử Optional Chaining (?.) để truy cập an toàn
                                displayName = data.customerName || (data.lastSenderType === 'customer' ? data.lastSenderName : `Khách hàng ${otherParticipantId}`); 
                                displayAvatar = data.customerAvatar || (data.lastSenderType === 'customer' ? data.senderAvatar : 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-user.png');
                            } else {
                                // Nếu là khách hàng, hiển thị thông tin cửa hàng
                                // Sử dụng toán tử Optional Chaining (?.) để truy cập an toàn
                                displayName = data.storeName || "Cửa hàng";
                                displayAvatar = data.storeAvatar || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png';
                            }

                            console.log("ChatListScreen - Determined displayName:", displayName, "displayAvatar:", displayAvatar);

                            // Đảm bảo có đầy đủ thông tin cần thiết
                            const chatData = {
                                id: doc.id,
                                ...data,
                                participants: participants,
                                displayName: displayName,
                                displayAvatar: displayAvatar,
                                otherParticipantId: otherParticipantId,
                                // Đảm bảo có storeId và userId
                                storeId: data.storeId || (isStore ? searchId : otherParticipantId),
                                userId: data.userId || (isStore ? otherParticipantId : searchId)
                            };

                            console.log("ChatListScreen - Processed chat data:", chatData);
                            return chatData;
                        }));
                        
                        console.log("ChatListScreen - Final chat list:", chatList);
                        setChats(chatList);
                        setLoading(false);
                    },
                    (error) => {
                        console.error("Error fetching chats:", error);
                        setLoading(false);
                    }
                );
            } catch (error) {
                console.error("Error setting up chat listener:", error);
                setLoading(false);
            }
        };

        setupChatListener();
        return () => unsubscribe();
    }, [user]);

    const renderChatItem = ({ item }) => {
        if (!user || !user.id) return null;
        
        const userIdStr = user.id.toString();
        console.log("ChatListScreen - Rendering chat item:", item);
        console.log("ChatListScreen - Current user ID:", userIdStr);
        
        // Xác định xem người dùng hiện tại là khách hàng hay cửa hàng
        const isStore = user.role === 'Chủ cửa hàng';
        console.log("ChatListScreen - Is current user store:", isStore);
        
        // Xác định storeId và userId dựa trên vai trò
        let storeId, userId;
        if (isStore) {
            // Nếu là cửa hàng, storeId là ID của cửa hàng
            storeId = user.store.id.toString();
            // userId là ID của người tham gia khác (khách hàng)
            userId = item.otherParticipantId;
        } else {
            // Nếu là khách hàng, storeId là ID của người tham gia khác (cửa hàng)
            storeId = item.otherParticipantId;
            // userId là ID của người dùng hiện tại
            userId = userIdStr;
        }
        
        console.log("ChatListScreen - Navigation params:", {
            storeId,
            userId,
            storeName: item.displayName,
            isNewChat: false
        });

        return (
            <TouchableOpacity 
                style={styles.chatItem}
                onPress={() => {
                    navigation.navigate('ChatScreen', {
                        storeId,
                        userId,
                        storeName: item.displayName,
                        isNewChat: false
                    });
                }}
            >
                <Avatar.Image 
                    size={50} 
                    source={{ uri: item.displayAvatar }} 
                />
                <View style={styles.chatInfo}>
                    <Text style={styles.storeName}>{item.displayName}</Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.lastMessage || 'Chưa có tin nhắn'}
                    </Text>
                </View>
                {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>{item.unreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (!user) {
        return (
            <View style={styles.emptyContainer}>
                <Icon name="account-lock" size={60} color="#ccc" />
                <Text style={styles.emptyText}>Vui lòng đăng nhập để xem tin nhắn</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.emptyContainer}>
                <Icon name="loading" size={60} color="#ccc" />
                <Text style={styles.emptyText}>Đang tải tin nhắn...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={item => item.id}
                ItemSeparatorComponent={() => <Divider />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Icon name="message-text-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    chatItem: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
    },
    chatInfo: {
        flex: 1,
        marginLeft: 15,
    },
    storeName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    unreadBadge: {
        backgroundColor: '#2196F3',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 50,
    },
    emptyText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
});

export default ChatListScreen; 