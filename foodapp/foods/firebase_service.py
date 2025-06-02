import os
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore  # Import rõ ràng

# Khởi tạo Firebase
def initialize_firebase():
    try:
        # Lấy đường dẫn tuyệt đối đến file cấu hình trong thư mục foods
        current_dir = os.path.dirname(os.path.abspath(__file__))
        cred_path = os.path.join(current_dir, "foodapp-firebase-adminsdk.json")
        
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Không tìm thấy file cấu hình Firebase tại: {cred_path}")
            
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return firestore.client()
    except Exception as e:
        print(f"Lỗi khởi tạo Firebase: {e}")
        return None

db = initialize_firebase()

def get_chat_room(user_id, store_id):
    """Tạo ID phòng chat duy nhất"""
    return f"user_{user_id}_store_{store_id}"

def send_message(room_id, message_data):
    """Gửi tin nhắn lên Firestore"""
    if db:
        try:
            doc_ref = db.collection("chats").document(room_id).collection("messages").document()
            message_data["timestamp"] = firestore.SERVER_TIMESTAMP  # <-- Sử dụng firestore
            doc_ref.set(message_data)
            return True
        except Exception as e:
            print(f"Lỗi gửi tin nhắn: {e}")
            return False
