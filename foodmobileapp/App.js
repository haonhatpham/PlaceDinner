import 'react-native-get-random-values';
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Icon, Provider as PaperProvider, IconButton } from "react-native-paper";
import { useContext, useReducer, useRef, useEffect } from "react";
import Home from "./Components/Home/Home";
import OrderListScreen from "./Components/Order/OrderListScreen";
import OrderScreen from "./Components/Order/OrderScreen";
import Login from "./Components/User/Login";
import Register from "./Components/User/Register";
import Profile from "./Components/User/Profile";
import SearchScreen from "./Components/Search/SearchScreen";
import DishDetail from "./Components/Food/DishDetail";
import ManageFoods from "./Components/Store/ManageFoods";
import ManageMenus from "./Components/Store/ManageMenus";
import StoreOrders from "./Components/Store/StoreOrders";
import StoreDetail from "./Components/Store/StoreDetail";
import { MyDispatchContext, MyUserContext } from "./configs/Contexts";
import MyUserReducer from "./reducers/MyUserReducer";
import ChatScreen from './Components/Chat/ChatScreen';
import ChatListScreen from './Components/Chat/ChatListScreen';
import MenuDetail from './Components/Home/MenuDetail';
import { useNavigation } from '@react-navigation/native';
import StoreStatsScreen from './Components/StoreStats/StoreStatsScreen';
import { LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, endpoints } from './configs/Apis';
import { AppState } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Ignore specific warning about text strings
LogBox.ignoreLogs(['Warning: Text strings must be rendered within a <Text> component.']);

// Thêm ChatStack vào các Stack Navigator
const ChatStack = () => {
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ChatList" 
        component={ChatListScreen}
        options={{ 
          title: "Tin nhắn",
          headerRight: () => (
            <IconButton
              icon="plus"
              size={24}
              onPress={() => navigation.navigate('Search')}
            />
          )
        }}
      />
      <Stack.Screen 
        name="ChatScreen" 
        component={ChatScreen}
        options={({ route }) => ({ 
          title: route.params?.storeName || "Nhắn tin với cửa hàng" 
        })}
      />
    </Stack.Navigator>
  );
};

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="Home" 
      component={Home} 
      options={{ 
        title: "Trang chủ",
        headerShown: false
      }} 
    />
    <Stack.Screen name="Order" component={OrderScreen} options={{ title: "Chi tiết đơn hàng" }} />
    <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Tìm kiếm món ăn" }} />
    <Stack.Screen name="Chat" component={ChatStack} options={{ headerShown: false }} />
    <Stack.Screen name="MenuDetail" component={MenuDetail} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const StoreStack = () => {
  const user = useContext(MyUserContext);
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ManageFoods" 
        component={ManageFoods} 
        options={{ title: "Quản lý món ăn" }} 
      />
      <Stack.Screen 
        name="ManageMenus" 
        component={ManageMenus} 
        options={{ title: "Quản lý Menu" }} 
      />
      <Stack.Screen 
        name="StoreOrders" 
        component={StoreOrders} 
        options={{ title: "Quản lý đơn hàng" }} 
      />
      <Stack.Screen 
        name="StoreStatistics"
        component={StoreStatsScreen}
        options={{ title: "Thống kê doanh thu" }} 
      />
      {user && (
        <Stack.Screen 
          name="Chat" 
          component={ChatStack} 
          options={{ headerShown: false }} 
        />
      )}
    </Stack.Navigator>
  );
};

const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProfileMain" component={Profile} options={{ title: "Tài khoản" }} />
  </Stack.Navigator>
);

// Stack Navigator riêng cho màn hình Thống kê
const StatsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="StoreStatistics" // Tên màn hình thống kê
      component={StoreStatsScreen}
      options={{
        title: "Thống kê doanh thu", // Tiêu đề cho màn hình thống kê
        // Add any other header options here if needed
      }}
    />
    {/* Add any other screens you might want accessible *within* the Stats tab's stack here */}
  </Stack.Navigator>
);

const TabNavigator = () => {
  const user = useContext(MyUserContext);

  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Trang chủ"
        component={HomeStack}
        options={{
          headerShown: false,
          title: "Trang chủ",
          tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="home" />,
        }}
      />
      <Tab.Screen
        name="Đơn hàng"
        component={OrderListScreen}
        options={{
          title: "Đơn hàng",
          tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="receipt" />,
        }}
      />
      {user === null ? (
        <>
          <Tab.Screen
            name="Đăng nhập"
            component={Login}
            options={{
              title: "Đăng nhập",
              tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="account" />,
            }}
          />
          <Tab.Screen
            name="Đăng ký"
            component={Register}
            options={{
              title: "Đăng ký",
              tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="account-plus-outline" />,
            }}
          />
        </>
      ) : (
        <>
          {user.role == 'Chủ cửa hàng' && user?.store && (
            <Tab.Screen
              name="Quản lý"
              component={StoreStack}
              options={{
                title: "Quản lý",
                tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="store" />,
              }}
            />
          )}
          <Tab.Screen
            name="Tài khoản"
            component={ProfileStack}
            options={{
              headerShown: false,
              title: "Tài khoản",
              tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="account" />,
            }}
          />
          {user && (
            <Tab.Screen
              name="ChatTab"
              component={ChatStack}
              options={{
                title: "Chat",
                tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="message-text" />,
              }}
            />
          )}
          {/* Add Store Statistics Tab for Store Owners */}
          {user?.role === 'Chủ cửa hàng' && user?.store && (
              <Tab.Screen
                name="Thống kê"
                component={StatsStack} // Use the new StatsStack
                options={{
                  title: "Thống kê",
                  tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="chart-bar" />,
                  headerShown: false, // Hide header for the tab itself, StatsStack will handle headers
                }}
              />
          )}
        </>
      )}
    </Tab.Navigator>
  );
};

// Tạo RootStack bao ngoài TabNavigator
const RootStack = createStackNavigator();

const RootNavigator = () => (
  <RootStack.Navigator>
    <RootStack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
    <RootStack.Screen name="StoreDetail" component={StoreDetail} options={{ title: "Chi tiết cửa hàng" }} />
    <RootStack.Screen name="DishDetail" component={DishDetail} options={{ title: "Chi tiết món ăn" }} />
    <RootStack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
    <RootStack.Screen name="Order" component={OrderScreen} options={{ title: "Chi tiết đơn hàng" }} />
  </RootStack.Navigator>
);

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const loadUser = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          console.log("Attempting to load user from AsyncStorage and validate token...");
          const userRes = await authApi(token).get(endpoints['current-user']);
          console.log("User loaded successfully.");
          dispatch({ type: 'login', payload: userRes.data });
        } catch (error) {
          console.error("Failed to load user from AsyncStorage or validate token:", error);
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('refresh_token');
          dispatch({ type: 'logout' });
        }
      } else {
         console.log("No token found in AsyncStorage.");
         dispatch({ type: 'logout' });
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        loadUser();
      }
      appState.current = nextAppState;
      console.log('AppState', appState.current);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    loadUser();

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <PaperProvider>
      <MyUserContext.Provider value={user}>
        <MyDispatchContext.Provider value={dispatch}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </MyDispatchContext.Provider>
      </MyUserContext.Provider>
    </PaperProvider>
  );
};

export default App;