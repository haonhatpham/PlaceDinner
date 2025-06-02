# foods/serializers.py
# from django.contrib.gis.serializers.geojson import Serializer
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import *
from django.db import transaction
from django.shortcuts import get_object_or_404

class AccountRegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', write_only=True)
    password = serializers.CharField(source='user.password', write_only=True)
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
            'id',
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
                'id': instance.store.id,
                'name': instance.store.name,
                'latitude': instance.store.latitude,
                'longitude': instance.store.longitude,
                'address': instance.store.address,
                'description': instance.store.description,
                'opening_hours': instance.store.opening_hours,
                'is_approved': instance.store.is_approved,
            }

        return data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
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

class FoodSerializer(serializers.ModelSerializer):
    reviews = ReviewSerializer(many=True, read_only=True)  # Thêm dòng này

    class Meta:
        model = Food
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hiển thị thông tin category và meal_time dạng text thay vì value
        data['category'] = CategorySerializer(instance.category).data if instance.category else None
        data['meal_time'] = instance.get_meal_time_display()


        if instance.image:
            data['image'] = instance.image.url if hasattr(instance.image, 'url') else str(instance.image)
        else:
            data['image'] = ''  # Hoặc URL ảnh mặc định
        return data


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('account',)




class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = '__all__'
        read_only_fields = ('customer',)

class StoreSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()  # Thêm dòng này
    reviews = ReviewSerializer(many=True, read_only=True)  # Thêm dòng này
    followers_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = '__all__'

    def get_avatar(self, obj):
        return obj.account.avatar.url if obj.account and obj.account.avatar else None

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(
                customer=request.user.account,
                store=obj
            ).exists()
        return False

class MenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = Menu
        fields= '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'amount', 'status', 'transaction_id', 'payment_url', 'payment_date']
        read_only_fields = fields


class OrderItemSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source='food.name', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'food', 'food_name', 'quantity', 'price', 'note']
        extra_kwargs = {
            'food': {'write_only': True},
            'price': {'read_only': True}
        }

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    payment = PaymentSerializer(read_only=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'store', 'store_name', 'customer_name', 'items', 'status',
            'delivery_address', 'payment', 'note', 'payment_method',
            'shipping_fee', 'total_amount', 'created_date'
        ]
        read_only_fields = ['status', 'created_date', 'total_amount']

    def validate(self, data):
        store = data.get('store')
        items = data.get('items', [])

        for item in items:
            food = item['food']
            # Nếu chỉ là ID thì lấy object Food
            if isinstance(food, int):
                food = get_object_or_404(Food, pk=food)
                item['food'] = food  # Gán lại để dùng sau này

            if food.store != store:
                raise serializers.ValidationError(
                    f"Món ăn {food.id} không thuộc cửa hàng này"
                )
        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user

        account, created = Account.objects.get_or_create(user=user)
        order = Order.objects.create(customer=account, **validated_data)

        # Thêm các món ăn
        for item_data in items_data:
            OrderItem.objects.create(
                order=order,
                food=item_data['food'],
                quantity=item_data['quantity'],
                price=item_data['food'].price,
                note=item_data.get('note')
            )

        # Tạo payment
        Payment.objects.create(
            order=order,
            amount=order.total_amount,
            status=(
                Payment.Status.COMPLETED
                if order.payment_method == Order.PaymentMethod.CASH
                else Payment.Status.PENDING
            )
        )

        return order

