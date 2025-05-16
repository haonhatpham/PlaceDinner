import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Icon } from "react-native-paper";
import { Provider as PaperProvider } from 'react-native-paper';
import { useContext, useReducer } from "react";
import Home from "./Components/Home/Home";
import OrderListScreen from "./Components/Order/OrderListScreen";
import OrderScreen from "./Components/Order/OrderScreen";
import NotificationScreen from "./Components/Notification/NotificationScreen";
import Login from "./Components/User/Login";
import Register from "./Components/User/Register";
import Profile from "./Components/User/Profile";
import SearchScreen from "./Components/Search/SearchScreen";
import DishDetail from "./Components/Food/DishDetail";
import RevenueStats from "./Components/Statistics/RevenueStats";
import { MyDispatchContext, MyUserContext } from "./configs/Contexts";
import MyUserReducer from "./reducers/MyUserReducer";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Home" component={Home} options={{ title: "Trang chủ" }} />
    <Stack.Screen name="Order" component={OrderScreen} options={{ title: "Chi tiết đơn hàng" }} />
    <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Tìm kiếm món ăn" }} />
    <Stack.Screen name="DishDetail" component={DishDetail} options={{ title: "Chi tiết món ăn" }} />
    <Stack.Screen name="RevenueStats" component={RevenueStats} options={{ title: "Thống kê doanh thu" }} />
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
      <Tab.Screen
        name="Thông báo"
        component={NotificationScreen}
        options={{
          title: "Thông báo",
          tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="bell" />,
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
        <Tab.Screen
          name="Tài khoản"
          component={Profile}
          options={{
            title: "Tài khoản",
            tabBarIcon: ({ color, size }) => <Icon size={30} color={color} source="account" />,
          }}
        />
      )}
    </Tab.Navigator>
  );
};

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);

  return (
    <PaperProvider>
      <MyUserContext.Provider value={user}>
        <MyDispatchContext.Provider value={dispatch}>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </MyDispatchContext.Provider>
      </MyUserContext.Provider>
    </PaperProvider>
  );
};

export default App;