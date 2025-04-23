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
from django.db.models import Q
from django.views.generic import View
from django.contrib.auth import logout
from django.shortcuts import render, redirect

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

#Cho chức năng tìm kiếm món ăn của customer
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
        if min_price or max_price:
            price_filter = Q()
            if min_price:
                price_filter &= Q(price__gte=min_price)
            if max_price:
                price_filter &= Q(price__lte=max_price)
            queryset = queryset.filter(price_filter)

        return queryset

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated(), IsStoreOwnerOrAdmin()]
        return [permissions.AllowAny()]

    # Cho review(comment + rating)
    @action(detail=True, methods=['get', 'post'], url_path='reviews',permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        food = get_object_or_404(Food, pk=pk)

        if request.method == 'GET':
            reviews = food.reviews.all()
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            serializer = ReviewSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(customer=request.user.account, food=food)
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)

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

class StoreViewSet(viewsets.ViewSet,generics.ListAPIView):
    queryset = Store.objects.filter(is_approved=True)
    serializer_class = StoreSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail= True,methods=['patch'])
    def approve_store(self,request,pk=None):
        try:
            store = Store.objects.get(pk=pk)
            store.active = True
            store.is_approved = True
            store.save()
            return Response({'message': f'Cửa hàng "{store.name}" đã được duyệt thành công!'})
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'],url_path='pending')
    def pending(self, request, pk=None):
        # Danh sách cửa hàng chưa duyệt (admin)
        try:
            stores = Store.objects.filter(is_approved=False)
            serializer = StoreSerializer(stores, many=True)
            return Response(serializer.data)
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    # Cho follower
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)
        customer = request.user.account

        # Kiểm tra role Customer
        if customer.role != Account.Role.CUSTOMER:
            return Response({"error": "Chỉ khách hàng được theo dõi"}, status=403)

        # Tạo hoặc xóa quan hệ theo dõi
        follow, created = Follow.objects.get_or_create(customer=customer, store=store)

        if not created:
            follow.delete()
            return Response({"status": "Đã bỏ theo dõi"})

        return Response({"status": "Đã theo dõi cửa hàng"})

    # Cho review(comment + rating)
    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)

        if request.method == 'GET':
            reviews = store.reviews.all()
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            serializer = ReviewSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(customer=request.user.account, store=store)
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)

class ReviewDetailView(viewsets.ViewSet,generics.UpdateAPIView,generics.DestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        review = get_object_or_404(Review, pk=self.kwargs['pk'])
        if review.customer != self.request.user.account:
            raise permissions.PermissionDenied("Bạn không có quyền sửa hoặc xoá review này.")
        return review


#==========Testing==========================================================
class LogoutView(View):
    def get(self,request):
        logout(request)
        return redirect('app:home')

class HomeView(View):
    template_name = 'login/home.html'
    def get(self,request):
        current_user = request.user
        return render(request,self.template_name,{'current_user':current_user})