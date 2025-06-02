import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, IconButton, Text, Avatar, ActivityIndicator } from 'react-native-paper';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../configs/FirebaseConfig';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MyUserContext } from '../../configs/Contexts';

export default function ChatScreen({ route, navigation }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollViewRef = useRef();
    const { userId, storeId, storeName, isNewChat } = route.params;
    const user = useContext(MyUserContext);

    console.log("ChatScreen - User Data:", JSON.stringify(user, null, 2));
    console.log("ChatScreen - Route Params:", route.params);

    useEffect(() => {
        if (!userId || !storeId) {
            console.log("Missing userId or storeId");
            setLoading(false);
            return;
        }

        // Đảm bảo ID được lưu dưới dạng string
        const userIdStr = userId.toString();
        const storeIdStr = storeId.toString();
        console.log("ChatScreen - User ID string:", userIdStr);
        console.log("ChatScreen - Store ID string:", storeIdStr);

        // Tạo roomId dựa trên thứ tự ID để đảm bảo tính nhất quán
        const sortedIds = [userIdStr, storeIdStr].sort();
        const roomId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
        console.log("ChatScreen - Setting up chat room:", roomId);
        
        // Tạo hoặc cập nhật thông tin phòng chat
        const setupChatRoom = async () => {
            try {
                const chatRef = doc(db, "chats", roomId);
                const chatDoc = await getDoc(chatRef);

                if (!chatDoc.exists() && isNewChat) {
                    console.log("ChatScreen - Creating new chat room");
                    // Lưu thông tin khách hàng nếu người dùng hiện tại là cửa hàng
                    const chatData = {
                        participants: [userIdStr, storeIdStr],
                        storeName: storeName,
                        createdAt: serverTimestamp(),
                        lastMessageTime: serverTimestamp(),
                        lastMessage: '',
                        unreadCount: 0,
                        storeId: storeIdStr,
                        userId: userIdStr,
                        // Thêm thông tin vai trò
                        participantRoles: {
                            [storeIdStr]: 'store',
                            [userIdStr]: 'customer'
                        }
                    };

                    // Lưu thông tin khách hàng và cửa hàng khi tạo chat mới
                    chatData.customerName = `${user.first_name} ${user.last_name}`;
                    chatData.customerAvatar = user.avatar || '';
                    chatData.storeName = storeName;
                    chatData.storeAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png'; // Avatar mặc định cho cửa hàng lúc tạo

                    await setDoc(chatRef, chatData);
                    console.log("ChatScreen - Created new chat room with data:", chatData);
                } else if (chatDoc.exists()) {
                    // Cập nhật thông tin phòng chat nếu thiếu
                    const updateData = {};
                    const currentData = chatDoc.data();
                    
                    if (!currentData.storeId) updateData.storeId = storeIdStr;
                    if (!currentData.userId) updateData.userId = userIdStr;
                    if (!currentData.participantRoles) {
                        updateData.participantRoles = {
                            [storeIdStr]: 'store',
                            [userIdStr]: 'customer'
                        };
                    }
                    
                    // Cập nhật thông tin khách hàng nếu thiếu (chỉ khi người dùng hiện tại là khách hàng)
                    if (!currentData.customerName && user.role !== 'Chủ cửa hàng') {
                         updateData.customerName = `${user.first_name} ${user.last_name}`;
                         updateData.customerAvatar = user.avatar || '';
                    }

                    // Cập nhật thông tin cửa hàng nếu thiếu (chỉ khi người dùng hiện tại là khách hàng)
                    if (!currentData.storeName && user.role !== 'Chủ cửa hàng') {
                         updateData.storeName = storeName;
                    }
                    // Cập nhật avatar cửa hàng nếu thiếu (chỉ khi người dùng hiện tại là khách hàng)
                     if (!currentData.storeAvatar && user.role !== 'Chủ cửa hàng') {
                         updateData.storeAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png';
                     }

                    
                    if (Object.keys(updateData).length > 0) {
                        await setDoc(chatRef, updateData, { merge: true });
                        console.log("ChatScreen - Updated chat room with missing data:", updateData);
                    }
                }
            } catch (error) {
                console.error("Error setting up chat room:", error);
                Alert.alert("Lỗi", "Không thể tạo phòng chat");
            } finally {
                setLoading(false);
            }
        };

        setupChatRoom();

        // Lắng nghe tin nhắn
        const q = query(
            collection(db, "chats", roomId, "messages"),
            orderBy("timestamp", "asc")
        );

        console.log("ChatScreen - Setting up messages listener for room:", roomId);
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                console.log("ChatScreen - Received messages update, count:", snapshot.docs.length);
                const messageList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(messageList);

                // Cuộn xuống tin nhắn mới nhất
                if (scrollViewRef.current) {
                    setTimeout(() => {
                        scrollViewRef.current.scrollToEnd({ animated: true });
                    }, 100);
                }
            },
            (error) => {
                console.error("Error listening to messages:", error);
                Alert.alert("Lỗi", "Không thể tải tin nhắn");
                setLoading(false);
            }
        );

        return () => {
            console.log("ChatScreen - Cleaning up chat screen");
            unsubscribe();
        };
    }, [userId, storeId]);

    const sendMessage = async () => {
        if (!text.trim() || !userId || !storeId) {
            console.log("Cannot send message: invalid input or missing data");
            return;
        }

        try {
            setSending(true);
            const userIdStr = userId.toString();
            const storeIdStr = storeId.toString();
            
            // Tạo roomId giống như trong useEffect
            const sortedIds = [userIdStr, storeIdStr].sort();
            const roomId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
            console.log("ChatScreen - Sending message to room:", roomId);
            
            // Thêm tin nhắn mới
            const messageRef = await addDoc(collection(db, "chats", roomId, "messages"), {
                text: text.trim(),
                timestamp: serverTimestamp(),
                sender: user.id.toString(), // Luôn dùng ID của user đang đăng nhập
                senderType: user.role === 'Chủ cửa hàng' ? 'store' : 'customer',
                senderName: `${user.first_name} ${user.last_name}`,
                senderAvatar: user.avatar || ''
            });
            console.log("ChatScreen - Message sent successfully:", messageRef.id);

            // Cập nhật thông tin phòng chat (lastMessage, lastMessageTime, lastSender, lastSenderType, lastSenderName)
            const chatRef = doc(db, "chats", roomId);
            const updateData = {
                lastMessage: text.trim(),
                lastMessageTime: serverTimestamp(),
                lastSender: user.id.toString(),
                lastSenderType: user.role === 'Chủ cửa hàng' ? 'store' : 'customer',
                lastSenderName: `${user.first_name} ${user.last_name}`,
                // unreadCount: logic này cần phức tạp hơn
            };

            // Cập nhật thông tin khách hàng/cửa hàng vào chat room nếu chưa có
            // Đảm bảo customerName, customerAvatar, storeName, storeAvatar luôn được cập nhật nếu thiếu
            const chatDoc = await getDoc(chatRef); // Lấy dữ liệu hiện tại để kiểm tra
            if (chatDoc.exists()) {
                const currentData = chatDoc.data();

                // Cập nhật thông tin khách hàng nếu thiếu
                if (!currentData.customerName && user.role !== 'Chủ cửa hàng') {
                     updateData.customerName = `${user.first_name} ${user.last_name}`;
                     updateData.customerAvatar = user.avatar || '';
                }

                // Cập nhật thông tin cửa hàng nếu thiếu
                 if (!currentData.storeName) {
                      if(user.role === 'Chủ cửa hàng' && user.store && user.store.name) {
                           // Nếu là cửa hàng gửi tin và storeName thiếu, lấy từ user context
                           updateData.storeName = user.store.name;
                      } else if (user.role !== 'Chủ cửa hàng') {
                           // Nếu là khách hàng gửi tin và storeName thiếu, lấy từ route params
                           updateData.storeName = storeName;
                      }
                 }

                // Cập nhật avatar cửa hàng nếu thiếu
                 if (!currentData.storeAvatar && user.role !== 'Chủ cửa hàng') {
                     updateData.storeAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png'; // Sử dụng avatar mặc định
                 }
            }

            await setDoc(chatRef, updateData, { merge: true });
            console.log("ChatScreen - Chat room updated with:", updateData);

            setText('');
        } catch (error) {
            console.error("Error sending message:", error);
            Alert.alert("Lỗi", "Không thể gửi tin nhắn");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = (message) => {
        // So sánh sender ID của tin nhắn với ID của người dùng hiện tại
        const isCurrentUser = message.sender === user.id.toString();
        
        // Xác định avatar và tên người gửi cho tin nhắn hiển thị
        let messageAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-user.png'; // Default customer avatar
        let senderDisplayName = message.senderName || 'Unknown';

        if (message.senderType === 'store') {
            // Nếu người gửi là cửa hàng, dùng avatar và tên cửa hàng
             messageAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png'; // Default store avatar
             // Tên cửa hàng có thể lấy từ route params hoặc từ dữ liệu chat room nếu có
             senderDisplayName = storeName || 'Cửa hàng';
        }

        return (
            <View key={message.id} style={[
                styles.messageContainer,
                isCurrentUser ? styles.userMessage : styles.otherMessage // Đổi storeMessage thành otherMessage
            ]}>
                {!isCurrentUser && (
                    <Avatar.Image 
                        size={30} 
                        source={{ uri: messageAvatar }} // Sử dụng avatar đã xác định
                        style={styles.avatar}
                    />
                )}
                <View style={[
                    styles.messageBubble,
                    isCurrentUser ? styles.userBubble : styles.otherBubble // Đổi storeBubble thành otherBubble
                ]}>
                     {!isCurrentUser && ( // Chỉ hiển thị tên người gửi nếu không phải là user hiện tại
                        <Text style={styles.senderName}>{senderDisplayName}</Text>
                     )}
                    <Text style={styles.messageText}>{message.text}</Text>
                    <Text style={styles.timestamp}>
                        {message.timestamp ? new Date(message.timestamp.toDate()).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                        }) : ''}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2196F3" />
                        <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="message-text-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyText}>Chưa có tin nhắn nào</Text>
                    </View>
                ) : (
                    messages.map(renderMessage)
                )}
            </ScrollView>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="Nhập tin nhắn..."
                    multiline
                    maxLength={500}
                    disabled={sending}
                />
                <IconButton
                    icon="send"
                    size={24}
                    onPress={sendMessage}
                    disabled={!text.trim() || sending}
                    style={[styles.sendButton, sending && styles.sendingButton]}
                    loading={sending}
                />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 10,
    },
    messageContainer: {
        flexDirection: 'row',
        marginVertical: 5,
        alignItems: 'flex-end',
    },
    userMessage: {
        justifyContent: 'flex-end',
    },
    otherMessage: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '70%',
        padding: 10,
        borderRadius: 15,
        marginHorizontal: 5,
    },
    userBubble: {
        backgroundColor: '#2196F3',
    },
    otherBubble: {
        backgroundColor: '#fff',
    },
    messageText: {
        fontSize: 16,
        color: '#000',
    },
    timestamp: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    avatar: {
        marginRight: 5,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 10,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#2196F3',
        margin: 0,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    sendingButton: {
        backgroundColor: '#ccc',
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2196F3',
        marginBottom: 4,
    },
});