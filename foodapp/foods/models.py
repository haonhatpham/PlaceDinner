from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models import TextChoices
from ckeditor.fields import RichTextField
from django.utils.html import strip_tags
from cloudinary.models import CloudinaryField


class BaseModel(models.Model):
    active = models.BooleanField(default=True)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# Tách user với account vì:
# Cần nhiều thông tin cho cửa hàng (address, description, opening_hours...)
# Cần tách biệt rõ authentication và profile
# Dễ dàng mở rộng thêm thông tin sau này


# AbstractUser của django đã có sẵn các trường username, password ,first_name, last_name, email, is_staff, is_active, is_superuser, last_login, date_joined
# User model chứa thông tin nhạy cảm (password) -> Xử lý authentication (đăng nhập, xác thực)
# Account model chứa thông tin công khai -> Lưu thông tin cá nhân, cấu hình
class User(AbstractUser):
    def __str__(self):
        return self.username

class Account(BaseModel):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Quản trị viên'
        CUSTOMER = 'CUSTOMER', 'Khách hàng'
        STORE = 'STORE', 'Chủ cửa hàng'

    avatar = CloudinaryField('avatar', null=True, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    # Trường is_verified để xác thực email của người dùng khi đăng kí,...
    is_verified = models.BooleanField(default=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account')

    def __str__(self):
        return self.user.username


class Store(BaseModel):
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name='store')
    name = models.CharField(max_length=255)
    description = RichTextField()
    address = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()
    opening_hours = models.CharField(max_length=255)
    is_active = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=False)  # Thêm trường để admin phê duyệt

    def __str__(self):
        return self.name

class Category(BaseModel):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Food(BaseModel):
    class MealTime(models.TextChoices):
        BREAKFAST = 'BREAKFAST', 'Bữa sáng'
        LUNCH = 'LUNCH', 'Bữa trưa'
        DINNER = 'DINNER', 'Bữa tối'
        ANYTIME = 'ANYTIME', 'Cả ngày'

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='foods')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    description = RichTextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = CloudinaryField('food_image')
    meal_time = models.CharField(max_length=10, choices=MealTime.choices, default=MealTime.ANYTIME)
    is_available = models.BooleanField(default=True)
    available_from = models.TimeField(null=True, blank=True)
    available_to = models.TimeField(null=True, blank=True)

    def __str__(self):
        return self.name


class Order(BaseModel):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Chờ xác nhận'
        CONFIRMED = 'CONFIRMED', 'Đã xác nhận'
        DELIVERING = 'DELIVERING', 'Đang giao'
        COMPLETED = 'COMPLETED', 'Hoàn thành'
        CANCELLED = 'CANCELLED', 'Đã hủy'

    class PaymentMethod(models.TextChoices):
        CASH = 'CASH', 'Tiền mặt'
        MOMO = 'MOMO', 'Momo'
        PAYPAL = 'PAYPAL', 'PayPal'
        STRIPE = 'STRIPE', 'Stripe'
        ZALOPAY = 'ZALOPAY', 'ZaloPay'

    customer = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='orders')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_address = models.CharField(max_length=255)
    note = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Order #{self.id} - {self.customer}"


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    food = models.ForeignKey(Food, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity}x {self.food.name}"


class Review(BaseModel):
    RATING_CHOICES = [
        (1, '1 sao'),
        (2, '2 sao'),
        (3, '3 sao'),
        (4, '4 sao'),
        (5, '5 sao'),
    ]

    customer = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='reviews')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='reviews')
    food = models.ForeignKey(Food, on_delete=models.CASCADE, null=True, blank=True)
    rating = models.PositiveSmallIntegerField(choices=RATING_CHOICES)
    comment = models.TextField()
    image = CloudinaryField('review_image', null=True, blank=True)

    def __str__(self):
        target = self.store if self.store else self.food
        return f"Review {self.rating} sao cho {target}"


class Follow(BaseModel):
    customer = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='following')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='followers')

    class Meta:
        unique_together = ('customer', 'store')

    def __str__(self):
        return f"{self.customer} follows {self.store}"


class Notification(BaseModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    notification_type = models.CharField(max_length=50)# 'NEW_FOOD', 'NEW_MENU',...
    related_id = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return self.title