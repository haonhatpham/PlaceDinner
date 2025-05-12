from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, DeliveryFeeViewSet, StoreLocationViewSet

router = DefaultRouter()
router.register('payments', PaymentViewSet, basename='payment')
router.register('delivery-fees', DeliveryFeeViewSet, basename='delivery-fee')
router.register('store-locations', StoreLocationViewSet, basename='store-location')

urlpatterns = router.urls 