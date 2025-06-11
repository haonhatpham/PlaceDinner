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
                console.log("Missing user data");
                setLoading(false);
                return;
            }

            try {
                const userIdStr = user.id ? user.id.toString() : '';
                if (!userIdStr) {
                    throw new Error("Invalid user ID format");
                }
                let searchId = userIdStr;
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
                            
                            const participants = Array.isArray(data.participants) 
                                ? data.participants.filter(id => id != null).map(id => id.toString())
                                : [];
                            
                            if (participants.length === 0) {
                                console.log("ChatListScreen - Invalid participants data, skipping chat:", doc.id);
                                return null;
                            }
                            
                            console.log("ChatListScreen - Participants:", participants);
                            
                            const otherParticipantId = participants.find(id => id !== searchId);
                            if (!otherParticipantId) {
                                console.log("ChatListScreen - Could not find other participant, skipping chat:", doc.id);
                                return null;
                            }
                            console.log("ChatListScreen - Other participant ID:", otherParticipantId);

                            let displayName, displayAvatar;
                            const isStore = user.role === 'Chủ cửa hàng';

                            if (isStore) {
                                displayName = data.customerName || (data.lastSenderType === 'customer' ? data.lastSenderName : `Khách hàng ${otherParticipantId}`); 
                                displayAvatar = data.customerAvatar || (data.lastSenderType === 'customer' ? data.senderAvatar : 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-user.png');
                            } else {
                                displayName = data.storeName || "Cửa hàng";
                                displayAvatar = data.storeAvatar;
                            }

                            console.log("ChatListScreen - Determined displayName:", displayName, "displayAvatar:", displayAvatar);

                            const chatData = {
                                id: doc.id,
                                ...data,
                                participants: participants,
                                displayName: displayName,
                                displayAvatar: displayAvatar,
                                otherParticipantId: otherParticipantId,
                                storeUserId: isStore ? searchId : otherParticipantId,
                                userId: isStore ? otherParticipantId : searchId
                            };

                            console.log("ChatListScreen - Processed chat data:", chatData);
                            return chatData;
                        }));
                        
                        const validChatList = chatList.filter(chat => chat != null);
                        console.log("ChatListScreen - Final chat list:", validChatList);
                        setChats(validChatList);
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
        
        const isStore = user.role === 'Chủ cửa hàng';
        console.log("ChatListScreen - Is current user store:", isStore);
        
        let storeUserId, userId;
        if (isStore) {
            storeUserId = userIdStr;
            userId = item.otherParticipantId;
        } else {
            storeUserId = item.otherParticipantId;
            userId = userIdStr;
        }
        
        console.log("ChatListScreen - Navigation params:", {
            storeUserId,
            userId,
            storeName: item.displayName,
            isNewChat: false
        });

        return (
            <TouchableOpacity 
                style={styles.chatItem}
                onPress={() => {
                    navigation.navigate('ChatScreen', {
                        storeUserId,
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