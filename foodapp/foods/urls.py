from django.urls import path, include
from rest_framework.routers import DefaultRouter
from foods.views import *
from django.contrib.auth.views import LoginView, LogoutView
from foods.webhook import momo_webhook_view

router = DefaultRouter()
router.register('users', UserViewSet, basename='user')
router.register('foods', FoodViewSet, basename='food')
router.register('menus', MenuViewSet, basename='menu')
router.register('stores', StoreViewSet, basename='store')
router.register('store-stats', StoreStatsViewSet, basename='store-stats')
router.register('reviews', ReviewDetailView, basename='review')
router.register('orders', OrderViewSet, basename='order')
router.register('categories', CategoryViewSet, basename='category')



urlpatterns = [
    path('', include(router.urls)),  # Sử dụng router
    path('momo/webhook/', momo_webhook_view, name='momo-webhook'),
    path('payments/create/', create_momo_payment, name='create_momo_payment'),
    # thống kê nằm ở đây
    path("admin/stats/", admin_stats_view, name="admin-stats"),

]