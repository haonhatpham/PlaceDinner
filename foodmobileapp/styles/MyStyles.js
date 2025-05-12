import { StyleSheet } from "react-native";

const MyStyles = StyleSheet.create({
    m: {
        margin: 10,
        padding: 10,
    },
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff'
    },
    input: {
        marginBottom: 15,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    button: {
        marginTop: 10,
        padding: 5,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 32,
        textAlign: 'center'
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    link: {
        color: '#007AFF',
        textAlign: 'center'
    },
    row: {
        flexDirection: "row"
    },
    wrap: {
        flexWrap: "wrap"
    },
    subject: {
        fontSize: 30,
        fontWeight: "bold",
        color: "blue"
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 50
    }
});

export default MyStyles;