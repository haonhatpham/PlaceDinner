from django.urls import path, include
from rest_framework.routers import DefaultRouter
from foods.views import UserViewSet

router = DefaultRouter()
router.register('user', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls))  # Sử dụng router
]