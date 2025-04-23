# foods/serializers.py
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, Account, Store, Food, Category, Notification,Review,Follow


class AccountRegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', write_only=True)
    password = serializers.CharField(write_only=True)  # Không cần 'source' ở đây nữa
    email = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)

    # Thông tin cửa hàng (chỉ dùng khi role là STORE)
    latitude = serializers.FloatField(write_only=True, required=False)
    longitude = serializers.FloatField(write_only=True, required=False)
    address = serializers.CharField(write_only=True, required=False)
    description = serializers.CharField(write_only=True, required=False)
    opening_hours = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Account
        fields = [
            'username', 'password', 'email',
            'first_name', 'last_name', 'avatar',
            'role', 'phone_number', 'latitude',
            'longitude', 'address', 'description',
            'opening_hours'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
        }

    def validate(self, attrs):
        role = attrs.get('role', Account.Role.CUSTOMER)

        # Avatar bắt buộc khi role là STORE
        if role == Account.Role.STORE and not attrs.get('avatar'):
            raise serializers.ValidationError({
                'avatar': 'Avatar là bắt buộc đối với tài khoản cửa hàng!'
            })

        # Kiểm tra các trường thông tin cửa hàng khi role là STORE
        if role == Account.Role.STORE:
            required_fields = ['latitude', 'longitude', 'address', 'description', 'opening_hours']
            for field in required_fields:
                if not attrs.get(field):
                    raise serializers.ValidationError({
                        field: f'Trường {field} là bắt buộc đối với tài khoản cửa hàng!'
                    })

        return attrs

    def create(self, validated_data):
        # Tách thông tin user từ dữ liệu đã validate
        user_data = validated_data.pop('user')
        user_data['password'] = make_password(user_data['password'])  # Băm password
        # Tạo User
        user = User.objects.create(**user_data)

        # Tách các trường liên quan đến Store
        store_data = {}
        for field in ['latitude', 'longitude', 'address', 'description', 'opening_hours']:
            if field in validated_data:
                store_data[field] = validated_data.pop(field)

        # Tạo Account
        account = Account.objects.create(user=user, **validated_data)

        # Nếu role là STORE, tạo Store
        if account.role == Account.Role.STORE:
            Store.objects.create(account=account, name=f"Cửa hàng {user.username}", **store_data)

        return account

    def to_representation(self, instance):
        # Gọi phương thức gốc trước
        data = super().to_representation(instance)

        # Xử lý avatar URL
        if instance.avatar:
            data['avatar'] = instance.avatar.url if hasattr(instance.avatar, 'url') else str(instance.avatar)
        else:
            data['avatar'] = ''  # Hoặc URL ảnh mặc định

        # Hiển thị giá trị choice field
        data['role'] = instance.get_role_display()

        # Thêm thông tin cửa hàng nếu role là STORE
        if instance.role == Account.Role.STORE and hasattr(instance, 'store'):
            data['store'] = {
                'name': instance.store.name,
                'latitude': instance.store.latitude,
                'longitude': instance.store.longitude,
                'address': instance.store.address,
                'description': instance.store.description,
                'opening_hours': instance.store.opening_hours,
                'is_active': instance.store.is_active,
                'is_approved': instance.store.is_approved,
            }

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

class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = '__all__'