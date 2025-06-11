import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, IconButton, Text, Avatar, ActivityIndicator } from 'react-native-paper';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../configs/FirebaseConfig';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MyUserContext } from '../../configs/Contexts';

// Helper function để chuyển đổi ID an toàn
const safeToString = (id) => {
    if (id == null) return '';
    try {
        return String(id);
    } catch (error) {
        console.error('Error converting ID to string:', error);
        return '';
    }
};

// Helper function để kiểm tra ID hợp lệ
const isValidId = (id) => {
    const idStr = safeToString(id);
    return idStr !== '';
};

export default function ChatScreen({ route, navigation }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollViewRef = useRef();
    const { userId, storeUserId, storeName, isNewChat, storeAvatar: routeStoreAvatar } = route.params;
    const user = useContext(MyUserContext);

    console.log("ChatScreen - User Data:", JSON.stringify(user, null, 2));
    console.log("ChatScreen - Route Params:", route.params);

    useEffect(() => {
        if (!isValidId(userId) || !isValidId(storeUserId) || !user || !isValidId(user.id)) {
            console.log("Missing or invalid required data: userId, storeUserId, or user data");
            setLoading(false);
            return;
        }

        const userIdStr = safeToString(userId);
        const storeUserIdStr = safeToString(storeUserId);
        const userCurrentId = safeToString(user.id);
        
        // Tạo roomId dựa trên thứ tự ID để đảm bảo tính nhất quán
        const sortedIds = [userIdStr, storeUserIdStr].sort();
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
                        participants: [userIdStr, storeUserIdStr],
                        storeName: storeName,
                        createdAt: serverTimestamp(),
                        lastMessageTime: serverTimestamp(),
                        lastMessage: '',
                        unreadCount: 0,
                        storeUserId: storeUserIdStr,
                        userId: userIdStr,
                        // Thêm thông tin vai trò
                        participantRoles: {
                            [storeUserIdStr]: 'store',
                            [userIdStr]: 'customer'
                        }
                    };

                    // Lưu thông tin khách hàng và cửa hàng khi tạo chat mới
                    chatData.customerName = `${user.first_name} ${user.last_name}`;
                    chatData.customerAvatar = user.avatar || '';
                    chatData.storeName = storeName;
                    chatData.storeAvatar = routeStoreAvatar || 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png';

                    await setDoc(chatRef, chatData);
                    console.log("ChatScreen - Created new chat room with data:", chatData);
                } else if (chatDoc.exists()) {
                    // Cập nhật thông tin phòng chat (bao gồm avatar) nếu cần
                    const updateData = {};
                    const currentData = chatDoc.data();

                    // Cập nhật thông tin khách hàng: ưu tiên user.avatar, nếu không thì giữ currentData
                    if (user.role !== 'Chủ cửa hàng') {
                        // Nếu người dùng hiện tại là khách hàng, cập nhật thông tin của mình
                        updateData.customerName = `${user.first_name} ${user.last_name}`;
                        updateData.customerAvatar = user.avatar || currentData.customerAvatar || '';
                    } else { 
                        // Nếu người dùng hiện tại là chủ cửa hàng, chỉ cập nhật thông tin khách nếu thiếu
                        if (!currentData.customerName) updateData.customerName = "Khách hàng";
                        if (!currentData.customerAvatar) updateData.customerAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-user.png';
                    }

                    // Cập nhật thông tin cửa hàng: ưu tiên routeStoreAvatar (nếu là khách), user.avatar (nếu là chủ), nếu không thì giữ currentData
                    if (user.role === 'Chủ cửa hàng') {
                        // Nếu người dùng hiện tại là chủ cửa hàng, cập nhật thông tin của mình
                        updateData.storeName = user.store.name; // Lấy tên cửa hàng từ context user
                        updateData.storeAvatar = user.avatar; // Lấy avatar của chủ cửa hàng từ context user
                    } else { 
                        // Nếu người dùng hiện tại là khách hàng, cập nhật thông tin cửa hàng nếu có
                        if (routeStoreAvatar) updateData.storeAvatar = routeStoreAvatar; // Ưu tiên avatar từ route params
                        else if (!currentData.storeAvatar) updateData.storeAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png';
                        
                        if (storeName) updateData.storeName = storeName; // Ưu tiên tên từ route params
                        else if (!currentData.storeName) updateData.storeName = "Cửa hàng";
                    }
                    
                    // Cập nhật các trường cố định khác nếu thiếu (như trước)
                    if (!currentData.storeUserId) updateData.storeUserId = storeUserIdStr;
                    if (!currentData.userId) updateData.userId = userIdStr;
                    if (!currentData.participantRoles) {
                        updateData.participantRoles = {
                            [storeUserIdStr]: 'store',
                            [userIdStr]: 'customer'
                        };
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        await setDoc(chatRef, updateData, { merge: true });
                        console.log("ChatScreen - Updated chat room with data:", updateData);
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
    }, [userId, storeUserId]);

    const sendMessage = async () => {
        if (!text.trim() || !isValidId(userId) || !isValidId(storeUserId) || !user || !isValidId(user.id)) {
            console.log("Cannot send message: invalid input or missing data");
            return;
        }

        try {
            setSending(true);
            const userIdStr = safeToString(userId);
            const storeUserIdStr = safeToString(storeUserId);
            const userCurrentId = safeToString(user.id);
            
            // Tạo roomId giống như trong useEffect
            const sortedIds = [userIdStr, storeUserIdStr].sort();
            const roomId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
            console.log("ChatScreen - Sending message to room:", roomId);
            
            // Thêm tin nhắn mới
            const messageRef = await addDoc(collection(db, "chats", roomId, "messages"), {
                text: text.trim(),
                timestamp: serverTimestamp(),
                sender: userCurrentId,
                senderType: user.role === 'Chủ cửa hàng' ? 'store' : 'customer',
                senderName: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'Unknown User',
                senderAvatar: user.avatar || ''
            });
            console.log("ChatScreen - Message sent successfully:", messageRef.id);

            // Cập nhật thông tin phòng chat (lastMessage, lastMessageTime, lastSender, lastSenderType, lastSenderName)
            const chatRef = doc(db, "chats", roomId);
            const updateData = {
                lastMessage: text.trim(),
                lastMessageTime: serverTimestamp(),
                lastSender: userCurrentId,
                lastSenderType: user.role === 'Chủ cửa hàng' ? 'store' : 'customer',
                lastSenderName: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'Unknown User',
            };

            const chatDoc = await getDoc(chatRef); // Lấy dữ liệu hiện tại để kiểm tra
            if (chatDoc.exists()) {
                const currentData = chatDoc.data();

                // Luôn cập nhật avatar của người gửi tin nhắn
                if (user.role !== 'Chủ cửa hàng') {
                    // Là khách hàng gửi tin, cập nhật avatar của khách
                    updateData.customerName = `${user.first_name} ${user.last_name}`;
                    updateData.customerAvatar = user.avatar || '';
                } else { 
                    // Là chủ cửa hàng gửi tin, cập nhật avatar của cửa hàng
                    updateData.storeName = user.store.name; 
                    updateData.storeAvatar = user.avatar; 
                }

                // Cập nhật thông tin bên còn lại (để đảm bảo không bị mất data)
                // Nếu người gửi là chủ cửa hàng, giữ thông tin khách hàng hiện có
                if (user.role === 'Chủ cửa hàng') {
                    if (currentData.customerName) updateData.customerName = currentData.customerName;
                    if (currentData.customerAvatar) updateData.customerAvatar = currentData.customerAvatar;
                } else { // Nếu người gửi là khách hàng, giữ thông tin cửa hàng hiện có
                    if (currentData.storeName) updateData.storeName = currentData.storeName;
                    if (currentData.storeAvatar) updateData.storeAvatar = currentData.storeAvatar;
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
        if (!user || !isValidId(user.id)) return null;
        
        // So sánh sender ID của tin nhắn với ID của người dùng hiện tại
        const userCurrentId = safeToString(user.id);
        const isCurrentUser = message.sender === userCurrentId;
        
        // Xác định avatar để hiển thị
        let messageAvatar = message.senderAvatar; // Ưu tiên dùng avatar thật của người gửi

        // Nếu không có avatar thật, dùng avatar mặc định dựa trên loại người gửi
        if (!messageAvatar) {
            if (message.senderType === 'store') {
                messageAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-store.png';
            } else { // customer
                messageAvatar = 'https://res.cloudinary.com/dtcxjo4ns/image/upload/v1745666322/default-user.png';
            }
        }
        
        let senderDisplayName = message.senderName || 'Unknown';

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