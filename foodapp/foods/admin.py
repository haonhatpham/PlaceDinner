# from django.contrib import admin
# from django.contrib.auth.admin import UserAdmin
# from .models import User, Account, Store
#
#
# class FoodManageAppAdminSite(admin.AdminSite):
#     site_header = 'HỆ THỐNG QUẢN LÝ CỬA HÀNG THỨC ĂN'
#     index_title = 'DjangoAdministration'
#
# class UserAdmin(admin.ModelAdmin):
#     list_display = ['id', 'username', 'first_name','last_name','email']
#     search_fields = ['username', 'role']
#
#
# class AccountAdmin(admin.ModelAdmin):
#     list_display = ['user' ,'phone_number' ,'role',]
#     search_fields =  ['user','phone_number' ,'role',]
#     list_filter = ['role']
#
#
# my_admin_site = FoodManageAppAdminSite(name='NhatHao_Admin')
# my_admin_site.register(User,UserAdmin)
# my_admin_site.register(Account,AccountAdmin)
