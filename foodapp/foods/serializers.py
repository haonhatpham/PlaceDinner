# foods/serializers.py
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, Account, Store, Food, Category, Notification,Review,Follow


class AccountRegisterSerializer(serializers.ModelSerializer):
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


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class FoodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Food
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hiển thị thông tin category và meal_time dạng text thay vì value
        data['category'] = CategorySerializer(instance.category).data if instance.category else None
        data['meal_time'] = instance.get_meal_time_display()
        return data


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('account',)


class ReviewSerializer(serializers.ModelSerializer):
    customer = serializers.StringRelatedField(read_only=True)  # Hiển thị tên user

    class Meta:
        model = Review
        fields = ['id', 'customer', 'store', 'food', 'rating', 'comment', 'image', 'created_date']
        read_only_fields = ('customer', 'created_date')

    def validate(self, data):
        # Kiểm tra: review phải thuộc store HOẶC food, không được cả hai
        if not (data.get('store') or data.get('food')):
            raise serializers.ValidationError("Review phải thuộc cửa hàng hoặc món ăn")
        if data.get('store') and data.get('food'):
            raise serializers.ValidationError("Chỉ được review 1 đối tượng mỗi lần")
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['rating_display'] = instance.get_rating_display()
        return data

class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = '__all__'
        read_only_fields = ('customer',)