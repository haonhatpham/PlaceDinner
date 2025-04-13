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
