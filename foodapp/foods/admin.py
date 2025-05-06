from django.contrib import admin
from .models import * # Import các model khác

# Tạo AdminSite tùy chỉnh
class FoodManageAppAdminSite(admin.AdminSite):
    site_header = 'HỆ THỐNG QUẢN LÝ CỬA HÀNG THỨC ĂN'
    index_title = 'Django Administration'
    site_title = 'FoodManage Admin'

# Inline để quản lý Account trong User
class AccountInline(admin.StackedInline):  # Hoặc sử dụng TabularInline nếu muốn bảng gọn hơn
    model = Account
    extra = 1  # Đặt số lượng form mặc định cho inline (1 form trống)

# Đăng ký model User với các thông tin Account inline
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'first_name', 'last_name', 'email']
    search_fields = ['username', 'email']
    inlines = [AccountInline]  # Thêm inline cho Account vào User Admin

# Đăng ký model Account riêng biệt (nếu cần cho các thao tác riêng biệt)
class AccountAdmin(admin.ModelAdmin):
    list_display = ['user', 'phone_number', 'role']
    search_fields = ['user__username', 'phone_number']
    list_filter = ['role']

# Đăng ký model Store vào Admin
class StoreAdmin(admin.ModelAdmin):
    list_display = ['name', 'get_account_username', 'address', 'is_approved', 'active']
    search_fields = ['name', 'account__user__username', 'address']  # Tìm kiếm theo username của owner (account liên kết với user)
    list_filter = ['is_approved', 'active']

    # Phương thức này lấy thông tin user từ Account
    def get_account_username(self, obj):
        return obj.account.user.username  # Lấy username từ user liên kết với account
    get_account_username.short_description = 'Account Owner'  # Tên hiển thị cho cột này trong Admin


# Category Admin
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']

# Food Admin
class FoodAdmin(admin.ModelAdmin):
    list_display = ['name', 'store', 'category', 'price', 'is_available']
    search_fields = ['name', 'store__name', 'category__name']
    list_filter = ['is_available', 'meal_time', 'store']

# Order Admin
class OrderAdmin(admin.ModelAdmin):
    list_display = ['customer', 'store', 'status', 'total_amount', 'delivery_address']
    search_fields = ['customer__user__username', 'store__name', 'status']
    list_filter = ['status', 'store']

# OrderItem Admin
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'food', 'quantity', 'price']
    search_fields = ['order__id', 'food__name']
    list_filter = ['order']

# Review Admin
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['customer', 'store', 'food', 'rating', 'comment', 'created_date']
    search_fields = ['customer__user__username', 'store__name', 'food__name']
    list_filter = ['rating', 'store']

# Đăng ký model Notification vào Admin
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['account', 'message', 'created_date', 'is_read']
    search_fields = ['account__user__username', 'message']
    list_filter = ['is_read']

# Đăng ký model Follow vào Admin
class FollowAdmin(admin.ModelAdmin):
    list_display = ['customer', 'store', 'created_date']
    search_fields = ['customer__user__username', 'store__name']

# Khởi tạo AdminSite mới
my_admin_site = FoodManageAppAdminSite(name='NhatHao_Admin')

# Đăng ký model vào AdminSite mới
my_admin_site.register(User, CustomUserAdmin)
my_admin_site.register(Account, AccountAdmin)
my_admin_site.register(Store, StoreAdmin)
my_admin_site.register(Food, FoodAdmin)
my_admin_site.register(Category, CategoryAdmin)
my_admin_site.register(Order, OrderAdmin)
my_admin_site.register(OrderItem, OrderItemAdmin)
my_admin_site.register(Review, ReviewAdmin)
my_admin_site.register(Follow, FollowAdmin)
my_admin_site.register(Notification, NotificationAdmin)