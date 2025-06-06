// Reducer để xử lý các actions liên quan đến người dùng
const MyUserReducer = (state, action) => {
    console.log("MyUserReducer - Current State:", JSON.stringify(state, null, 2));
    console.log("MyUserReducer - Action Type:", action.type);
    console.log("MyUserReducer - Action Payload:", JSON.stringify(action.payload, null, 2));

    switch (action.type) {
        case 'login':
            return action.payload;
        case 'logout':
            return null;
        default:
            return state;
    }
};

export default MyUserReducer; 