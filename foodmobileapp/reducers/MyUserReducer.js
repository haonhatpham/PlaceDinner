// Reducer để xử lý các actions liên quan đến người dùng
const MyUserReducer = (state, action) => {
    console.log("MyUserReducer - Current State:", state);
    console.log("MyUserReducer - Action:", action);

    switch (action.type) {
        case 'login':
            // Khi đăng nhập thành công, cập nhật state với thông tin người dùng
            console.log("Reducer - Login payload:", JSON.stringify(action.payload, null, 2));
            return action.payload;
        case 'logout':
            // Khi đăng xuất, reset state về null
            console.log("MyUserReducer - Logging out");
            return null;
        default:
            return state;
    }
};

export default MyUserReducer; 