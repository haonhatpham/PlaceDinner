from django.urls import path, include
from rest_framework.routers import DefaultRouter
from foods.views import UserViewSet, FoodViewSet, FollowViewSet,StoreViewSet

router = DefaultRouter()
router.register('users', UserViewSet, basename='user')
router.register('foods', FoodViewSet, basename='food')
# router.register('reviews', ReviewViewSet, basename='review')
router.register('follows', FollowViewSet, basename='follow')
router.register('stores', StoreViewSet, basename='store')

urlpatterns = [
    path('', include(router.urls))  # Sử dụng router
]
