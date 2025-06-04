from django.core.validators import MinValueValidator
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models import TextChoices
from ckeditor.fields import RichTextField
from django.utils.html import strip_tags
from cloudinary.models import CloudinaryField
from django.db.models import Sum, Min

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
    is_approved = models.BooleanField(default=False) # Chờ admin duyệt

    def save(self, *args, **kwargs):
        if self._state.adding and self.active is None:
            self.active = False
        super().save(*args, **kwargs)

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
    description = RichTextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = CloudinaryField('food_image')
    meal_time = models.CharField(max_length=10, choices=MealTime.choices, default=MealTime.ANYTIME)
    is_available = models.BooleanField(default=True)
    available_from = models.TimeField(null=True, blank=True)
    available_to = models.TimeField(null=True, blank=True)

    def __str__(self):
        return self.name


class Menu(BaseModel):
    MENU_TYPE_CHOICES = (
        ('BREAKFAST', 'Bữa sáng'),
        ('LUNCH', 'Bữa trưa'),
        ('DINNER', 'Bữa tối'),
    )

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='menus')
    name = models.CharField(max_length=255)
    menu_type = models.CharField(max_length=10, choices=MENU_TYPE_CHOICES)
    # Liên kết nhiều-nhiều với món ăn
    foods = models.ManyToManyField('Food', related_name='menus')

    def __str__(self):
        return f"{self.name} ({self.store.name})"

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
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices,default=PaymentMethod.CASH)
    delivery_address = models.CharField(max_length=255)
    note = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Order #{self.id} - {self.customer}"

    @property
    def total_amount(self):
        items_total = sum(item.price * item.quantity for item in self.items.all())
        return items_total + self.shipping_fee


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    food = models.ForeignKey('Food', on_delete=models.PROTECT)  # PROTECT để tránh xóa nhầm món ăn đã có đơn
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    note = models.CharField(max_length=255, blank=True, null=True)  # Ghi chú riêng cho món

    def __str__(self):
        return f"{self.quantity}x {self.food.name}"

class Payment(BaseModel):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Chờ thanh toán'
        PROCESSING = 'PROCESSING', 'Đang xử lý'
        COMPLETED = 'COMPLETED', 'Đã thanh toán'
        FAILED = 'FAILED', 'Thanh toán thất bại'
        REFUNDED = 'REFUNDED', 'Đã hoàn tiền'

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    payment_url = models.CharField(max_length=255, blank=True, null=True)
    payment_date = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Payment for Order #{self.order.id}"

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
    food = models.ForeignKey(Food, on_delete=models.CASCADE, null=True, blank=True,related_name='reviews')
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
