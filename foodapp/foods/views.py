from rest_framework import viewsets, generics, permissions, status,parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .serializers import *
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import *
from  .permissions import *
from django.core.mail import send_mail
from rest_framework.generics import get_object_or_404, RetrieveAPIView


class UserViewSet(viewsets.ViewSet, generics.CreateAPIView):
    serializer_class = AccountRegisterSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser]

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():#Đảm bảo xảy ra , không thì không lưu
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                account = serializer.save()

                response_data = serializer.to_representation(account)
                return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='current-user')
    def current_user(self, request):
        account = request.user.account
        serializer = AccountRegisterSerializer(account)
        return Response(serializer.data)

#Lấy danh sách và xem chi tiết món ăn
class FoodViewSet(viewsets.ViewSet, generics.ListAPIView, generics.RetrieveAPIView,generics.CreateAPIView):
    serializer_class = FoodSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'meal_time', 'is_available']
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'created_date']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]  # Mặc định

    # Cho tìm kiếm
    def get_queryset(self):
        queryset = Food.objects.filter(is_available=True)

        # Lọc theo cửa hàng (nếu có query param `store_id`)
        store_id = self.request.query_params.get('store_id')
        if store_id:
            queryset = queryset.filter(store_id=store_id)

        # Lọc theo khoảng giá
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        return queryset

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated(), IsStoreOwnerOrAdmin()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        """Xử lý khi tạo món mới (bao gồm gửi thông báo)"""
        with transaction.atomic():  # Đảm bảo toàn vẹn dữ liệu
            #Lưu món ăn, tự động gán cửa hàng của user hiện tại
            store = self.request.user.account.store
            food = serializer.save(store=store)

            #Gửi thông báo cho followers
            followers = Follow.objects.filter(store=store).select_related('customer__user')
            for follow in followers:
                self._create_notification(follow.customer, store, food)
                self._send_email_if_possible(follow.customer.user, store, food)

    def _create_notification(self, customer, store, food):
        """Tạo thông báo trong database"""
        Notification.objects.create(
            account=customer,
            title=f"🍜 {store.name} có món mới!",
            message=f"{food.name} - Giá: {food.price:,}đ",
            notification_type='NEW_FOOD',
            related_id=food.id
        )

    def _send_email_if_possible(self, user, store, food):
        """Gửi email nếu user có email (tuỳ chọn)"""
        if user.email:
            send_mail(
                subject=f"📢 {store.name} vừa thêm {food.name}",
                message=f"Đặt ngay món {food.name} với giá {food.price:,}đ!",
                from_email="no-reply@foodapp.com",
                recipient_list=[user.email],
                fail_silently=True
            )

class NotificationViewSet(viewsets.ViewSet, generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(account=self.request.user.account).order_by('-created_date')

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = get_object_or_404(Notification, pk=pk)
        notification.is_read = True
        notification.save()
        return Response({'status': 'Đã đánh dấu là đã đọc'})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        Notification.objects.filter(account=request.user.account, is_read=False).update(is_read=True)
        return Response({'status': 'Đã đánh dấu tất cả là đã đọc'})

class FollowViewSet(viewsets.ViewSet, generics.ListAPIView, generics.CreateAPIView, generics.DestroyAPIView):
    serializer_class = FollowSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Follow.objects.filter(customer=self.request.user.account)

# chưa xong
# class ReviewViewSet(viewsets.ViewSet, generics.ListAPIView, generics.CreateAPIView):
#     serializer_class = ReviewSerializer
#     permission_classes = [permissions.IsAuthenticatedOrReadOnly]
#     filter_backends = [DjangoFilterBackend]
#     filterset_fields = ['store', 'food', 'rating']
#
#     def get_queryset(self):
#         # Lọc reviews theo store_id hoặc food_id nếu có trong URL
#         queryset = Review.objects.all()
#
#         # Lấy từ URL pattern: /stores/{id}/reviews/
#         store_id = self.request.query_params.get('store_id')
#         if store_id:
#             queryset = queryset.filter(store_id=store_id)
#
#         # Lấy từ URL pattern: /foods/{id}/reviews/
#         food_id = self.request.query_params.get('food_id')
#         if food_id:
#             queryset = queryset.filter(food_id=food_id)
#
#         return queryset
#
#     def get_permissions(self):
#         if self.action in ['create']:
#             return [permissions.IsAuthenticated(), IsCustomer()]
#         return [permissions.AllowAny()]
#
#     def perform_create(self, serializer):
#         if self.request.user.account.role == Account.Role.CUSTOMER:
#             serializer.save(customer=self.request.user.account)

class StoreViewSet(viewsets.ViewSet,generics.ListAPIView, generics.UpdateAPIView):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    permission_classes = [permissions.IsAuthenticated]

    # xác nhận của người quản trị thì tài khoản mới
    @action(detail= True,methods=['patch'])
    def approve_store(self,request,pk=None):
        try:
            store = Store.objects.get(pk=pk)
            store.is_active = True
            store.is_approved = True
            store.save()
            return Response({'message': f'Cửa hàng "{store.name}" đã được duyệt thành công!'})
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    # get all các is_active= false
    @action(detail=False, methods=['get'],url_path='is_approved')
    def get_stores(self, request, pk=None):
        try:
            is_approved = Store.objects.filter(is_active=False)
            serializer = self.get_serializer(is_approved, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)
