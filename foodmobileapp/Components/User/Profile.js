import React, { useContext } from 'react';
import { View, Text, Button } from 'react-native';
import { MyUserContext, MyDispatchContext } from '../../configs/Contexts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Profile = ({ navigation }) => {
  const user = useContext(MyUserContext);
  const dispatch = useContext(MyDispatchContext);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refresh_token');
    dispatch({ type: 'logout' });
    navigation.replace('Đăng nhập');
  };

  if (!user) return <Text>Bạn chưa đăng nhập!</Text>;

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Xin chào, {user.username || 'User'}!</Text>
      <Text>Email: {user.email}</Text>
      {/* Thêm các thông tin khác nếu muốn */}
      <Button title="Đăng xuất" onPress={logout} />
    </View>
  );
};

export default Profile;
