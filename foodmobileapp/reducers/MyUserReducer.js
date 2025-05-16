// Reducer để xử lý các actions liên quan đến người dùng
const MyUserReducer = (state, action) => {
    console.log("MyUserReducer - Current State:", state);
    console.log("MyUserReducer - Action:", action);

    switch (action.type) {
        case 'login':
            // Khi đăng nhập thành công, cập nhật state với thông tin người dùng
            console.log("MyUserReducer - New State after login:", action.payload);
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