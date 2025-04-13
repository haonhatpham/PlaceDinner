# foods/serializers.py
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, Account,Store


class AccountRegisterSerializer(serializers.ModelSerializer):
    """
        Serializer cho model Account, xử lý thông tin tài khoản mở rộng
        Lồng ghép UserSerializer để xử lý cùng lúc thông tin User và Account
    """
    username = serializers.CharField(source='user.username', write_only=True)
    password = serializers.CharField(source='user.password', write_only=True)
    email = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)

    class Meta:
        model = Account
        fields = [
            'username', 'password', 'email',
            'first_name', 'last_name', 'avatar',
            'role', 'phone_number'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
        }

    # Ghi đè phương thức create để xử lý tạo đồng thời User và Account
    def create(self, validated_data):
        # Bước 1: Tách thông tin user từ dữ liệu đã validate
        user_data = validated_data.pop('user')
        user_data['password'] = make_password(user_data['password'])  # Băm password
        # Tạo user
        user = User.objects.create(**user_data)
        # Tạo account
        account = Account.objects.create(user=user, **validated_data)
        # Nếu là cửa hàng thì tạo Store
        if account.role == Account.Role.STORE:
            Store.objects.create(account=account, name=f"Cửa hàng {user.username}")

        return account

    # Hàm này ghi đè cách dữ liệu Account được hiển thị
    def to_representation(self, instance):
        # Gọi phương thức gốc trước
        data = super().to_representation(instance)

        # Xử lý avatar URL
        if instance.avatar:
            # Nếu dùng Cloudinary, avatar đã là URL đầy đủ
            data['avatar'] = instance.avatar.url if hasattr(instance.avatar, 'url') else str(instance.avatar)
        else:
            data['avatar'] = ''  # Hoặc có thể trả về None hoặc URL ảnh mặc định

        # Hiển thị giá trị choice field -> Khách hàng thay vì CUSTOMER trong db
        data['role'] = instance.get_role_display()

        return data