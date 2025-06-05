import uuid
from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, generics, permissions, status, parsers
from rest_framework.decorators import action, api_view
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from .serializers import *
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import *
from .permissions import *
from django.core.mail import send_mail
from rest_framework.generics import get_object_or_404, RetrieveAPIView, UpdateAPIView
from django.views.generic import View
from django.contrib.auth import logout
from django.shortcuts import render, redirect
from django.db.models import Sum, F, Count,Avg,Q,ExpressionWrapper, DecimalField
from .momo import create_momo_payment
from django.utils import timezone
import logging
from foods import paginators
from datetime import timedelta
from decimal import Decimal
from .dao import get_store_stats



class UserViewSet(viewsets.ViewSet, generics.CreateAPIView):
    serializer_class = AccountRegisterSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser]

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():  # Đảm bảo xảy ra , không thì không lưu
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

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='current_user')
    def current_user(self, request):
        account = request.user.account
        serializer = AccountRegisterSerializer(account)
        return Response(serializer.data)


# Cho chức năng tìm kiếm món ăn của customer
class FoodViewSet(viewsets.ViewSet, generics.ListAPIView, generics.RetrieveAPIView,generics.UpdateAPIView):
    serializer_class = FoodSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'meal_time', 'is_available']
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'created_date']
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]  # Mặc định
    pagination_class = paginators.ItemPaginator

    # Cho tìm kiếm
    def get_queryset(self):
        queryset = Food.objects.filter(is_available=True).order_by('-created_date')

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
    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        food = get_object_or_404(Food, pk=pk)

        if request.method == 'GET':
            reviews = food.reviews.filter(food__isnull=False)
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            serializer = ReviewSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(customer=request.user.account, food=food)
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)

    @action(detail=False, methods=['GET', 'POST'], url_path='my-store', permission_classes=[permissions.AllowAny])
    def get_my_store_foods(self, request):
        if request.method == 'GET':
            foods = Food.objects.filter(store=request.user.account.store)
            serializer = self.get_serializer(foods, many=True)
            return Response(serializer.data)
        # POST
        try:
            serializer = FoodSerializer(data=request.data)
            if serializer.is_valid():
                food = serializer.save(store=request.user.account.store)

                # Kiểm tra xem có follower không
                has_followers = food.store.followers.exists()

                response_data = serializer.data
                response_data.update({
                    'message': 'Tạo món ăn thành công',
                    'has_followers': has_followers,
                    'notification_status': 'Đang gửi thông báo' if has_followers else 'Không có follower'
                })

                return Response(response_data, status=status.HTTP_201_CREATED)
            return Response({
                'error': 'Dữ liệu không hợp lệ',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Lỗi khi tạo món ăn: {str(e)}")
            return Response({
                'error': 'Có lỗi xảy ra khi tạo món ăn',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def update_availability(self, request, pk=None):
        food = get_object_or_404(Food, pk=pk)

        # Kiểm tra quyền sở hữu
        if food.store.account != request.user.account:
            return Response({'error': 'Bạn không có quyền cập nhật món ăn này.'}, status=status.HTTP_403_FORBIDDEN)

        is_available = request.data.get('is_available')
        if is_available is None:
            return Response({'error': 'Thiếu trường is_available'}, status=status.HTTP_400_BAD_REQUEST)

        food.is_available = is_available
        food.save()

        return Response({
            'message': 'Trạng thái món ăn đã được cập nhật.',
            'is_available': food.is_available
        })

class StoreViewSet(viewsets.ViewSet, generics.ListAPIView, generics.RetrieveAPIView,generics.UpdateAPIView):
    queryset = Store.objects.filter(is_approved=True).select_related('account') \
        .annotate(followers_count=Count('followers'))  # Thêm số lượng người theo dõi # Thêm select_related
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAuthenticated])
    def update_opening_hours(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)
        new_hours = request.data.get('opening_hours')
        store.opening_hours = new_hours
        store.save()

        return Response({
            "message": "Đã cập nhật thời gian mở cửa",
            "opening_hours": store.opening_hours
        })

    @action(detail=True, methods=['patch'])
    def approve_store(self, request, pk=None):
        try:
            store = Store.objects.get(pk=pk)
            store.active = True
            store.is_approved = True
            store.save()
            return Response({'message': f'Cửa hàng "{store.name}" đã được duyệt thành công!'})
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='pending')
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
        follow, created = Follow.objects.select_related('customer').get_or_create(
            customer=customer,
            store=store
        )

        if not created:
            follow.delete()
            return Response({
                "status": "Đã bỏ theo dõi",
                "is_following": False,
                "followers_count": store.followers.count()
            })

        return Response({
            "status": "Đã theo dõi cửa hàng",
            "is_following": True,
            "followers_count": store.followers.count()
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def following(self, request):
        """Lấy danh sách cửa hàng đang theo dõi"""
        customer = request.user.account
        stores = Store.objects.filter(followers__customer=customer) \
            .select_related('account') \
            .annotate(followers_count=Count('followers'))

        serializer = self.get_serializer(stores, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def check_following(self, request, pk=None):
        """Kiểm tra xem người dùng có đang theo dõi cửa hàng không"""
        store = get_object_or_404(Store, pk=pk)
        customer = request.user.account

        is_following = Follow.objects.filter(
            customer=customer,
            store=store
        ).exists()

        return Response({
            "is_following": is_following,
            "followers_count": store.followers.count()
        })


    # Cho review(comment + rating)
    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)

        if request.method == 'GET':
            reviews = store.reviews.filter(food__isnull=True)
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            serializer = ReviewSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(customer=request.user.account, store=store)
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)


    @action(detail=False, methods=['get'], url_path='my-store', permission_classes=[permissions.IsAuthenticated])
    def my_store(self, request):
        # GET /stores/my-store/ → Lấy thông tin cửa hàng của user(là chủ cửa hàng)
        store = request.user.store
        serializer = self.get_serializer(store)
        return Response(serializer.data)


class ReviewDetailView(viewsets.ViewSet, generics.UpdateAPIView, generics.DestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        review = get_object_or_404(Review, pk=self.kwargs['pk'])
        if review.customer != self.request.user.account:
            raise permissions.PermissionDenied("Bạn không có quyền sửa hoặc xoá review này.")
        return review


# class NotificationViewSet(viewsets.ViewSet, generics.ListAPIView):
#     serializer_class = NotificationSerializer
#     permission_classes = [permissions.IsAuthenticated]

#     def get_queryset(self):
#         return Notification.objects.filter(account=self.request.user.account).order_by('-created_date')

#     @action(detail=True, methods=['post'])
#     def mark_as_read(self, request, pk=None):
#         notification = get_object_or_404(Notification, pk=pk)
#         notification.is_read = True
#         notification.save()
#         return Response({'status': 'Đã đánh dấu là đã đọc'})

#     @action(detail=False, methods=['post'])
#     def mark_all_as_read(self, request):
#         Notification.objects.filter(account=request.user.account, is_read=False).update(is_read=True)
#         return Response({'status': 'Đã đánh dấu tất cả là đã đọc'})


class OrderViewSet(viewsets.ViewSet, generics.CreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]  # Cho khách hàng đặt món

    def get_queryset(self):
        user = self.request.user.account
        if hasattr(user, 'store'):
            # Store owner chỉ xem đơn thuộc về store của họ
            return Order.objects.filter(store=user.store)
        # Customer chỉ xem đơn của chính họ
        return Order.objects.filter(customer=user)

    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        orders = Order.objects.filter(customer=request.user.account)
        return Response(self.get_serializer(orders, many=True).data)

    # GET /orders/my-store/ → Lấy đơn hàng của cửa hàng hiện tại (chủ cửa hàng)
    @action(detail=False, methods=['GET'], url_path='my-store', permission_classes=[IsStoreOwner])
    def get_my_store_orders(self, request):
        orders = Order.objects.filter(store=request.user.account.store)
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)

    # PATCH /orders/{id}/confirm/ → Xác nhận đơn hàng
    @action(detail=True, methods=['PATCH'], url_path='confirm', permission_classes=[IsStoreOwner])
    def confirm_order(self, request, pk=None):
        order = self.get_object()
        order.status = Order.Status.CONFIRMED
        order.save()
        return Response({'status': 'Đã xác nhận đơn hàng'})

    @action(detail=True, methods=["patch"], url_path="deliver", permission_classes=[IsStoreOwner])
    def deliver_order(self, request, pk=None):
        order = self.get_object()
        order.status = Order.Status.COMPLETED
        order.save()
        return Response({"message": "Đơn đã giao thành công."})


from django.db.models.functions import TruncYear, TruncQuarter, TruncMonth,TruncDate
# Cho Admin Dashboard (Web)
def admin_stats_view(request):
    # Lấy tham số từ request
    period = request.GET.get('period', 'month')
    store_id = request.GET.get('store_id')

    # Xác định khoảng thời gian
    now = timezone.now()
    if period == 'month':
        start_date = now - timedelta(days=30)
    elif period == 'quarter':
        start_date = now - timedelta(days=90)
    else:  # year
        start_date = now - timedelta(days=365)

    # Query cơ bản cho đơn hàng trong khoảng thời gian
    orders_in_period = Order.objects.filter(created_date__gte=start_date)
    if store_id:
        orders_in_period = orders_in_period.filter(store_id=store_id)

    # Query cho các đơn hàng đã hoàn thành hoặc đang giao trong khoảng thời gian
    completed_or_delivering_orders_in_period = orders_in_period.filter(
        status__in=[Order.Status.COMPLETED, Order.Status.DELIVERING]
    )

    # Tính tổng doanh thu từ OrderItem cho các đơn hàng đã hoàn thành/đang giao
    items_revenue_total = OrderItem.objects.filter(
        order__in=completed_or_delivering_orders_in_period,
    ).aggregate(
        total=Sum(ExpressionWrapper(
            F('price') * F('quantity'),
            output_field=DecimalField()
        ))
    )['total'] or Decimal('0')

    # Tính phí vận chuyển cho các đơn hàng đã hoàn thành/đang giao
    shipping_fee_total = completed_or_delivering_orders_in_period.aggregate(
        total=Sum('shipping_fee')
    )['total'] or Decimal('0')

    # Tổng doanh thu thực tế
    total_revenue = items_revenue_total + shipping_fee_total

    # Thống kê tổng quan
    stats = {
        'total_orders': orders_in_period.count(),
        'total_revenue': total_revenue,
        'average_order_value': total_revenue / completed_or_delivering_orders_in_period.count() if completed_or_delivering_orders_in_period.exists() else 0,
        'total_foods': Food.objects.filter(store_id=store_id).count() if store_id else Food.objects.count(), # Có thể cần lọc theo active=True nếu cần
        'total_stores': Store.objects.filter(is_approved=True, active=True).count(),
        'total_customers': Account.objects.filter(role=Account.Role.CUSTOMER, active=True).count(),
        'total_pending_stores': Store.objects.filter(is_approved=False, active=True).count(),
        'total_reviews': Review.objects.filter(created_date__gte=start_date).count(),
        'average_rating': Review.objects.filter(created_date__gte=start_date).aggregate(avg=Avg('rating'))['avg'] or 0,
    }

    # Thống kê theo trạng thái đơn hàng
    order_status_stats = []
    # Lấy verbose name cho từng status
    status_verbose_map = dict(Order.Status.choices)
    for status, verbose_status in Order.Status.choices:
        status_orders = orders_in_period.filter(status=status)
        # Doanh thu theo trạng thái (chỉ tính các trạng thái liên quan đến doanh thu nếu cần)
        status_items_revenue = OrderItem.objects.filter(
            order__in=status_orders,
            order__status__in=[Order.Status.COMPLETED, Order.Status.DELIVERING] # Chỉ tính doanh thu cho đơn đã hoàn thành/giao
        ).aggregate(
             total=Sum(ExpressionWrapper(
                F('price') * F('quantity'),
                output_field=DecimalField()
            ))
        )['total'] or Decimal('0')

        status_shipping_fee = status_orders.filter(
             status__in=[Order.Status.COMPLETED, Order.Status.DELIVERING] # Chỉ tính phí vận chuyển cho đơn đã hoàn thành/giao
        ).aggregate(
            total=Sum('shipping_fee')
        )['total'] or Decimal('0')

        order_status_stats.append({
            'status': status,
            'verbose_status': verbose_status, # Thêm verbose status
            'count': status_orders.count(),
            'revenue': status_items_revenue + status_shipping_fee # Doanh thu theo trạng thái
        })

    # Thống kê món ăn bán chạy
    top_foods = OrderItem.objects.filter(
        order__in=completed_or_delivering_orders_in_period # Chỉ tính các món trong đơn đã hoàn thành/giao
    ).values(
        'food__name', 'food__store__name' # Giữ lại tên cửa hàng để tooltip hiển thị
    ).annotate(
        total_sold=Sum('quantity'),
        revenue=Sum(ExpressionWrapper( # Tính doanh thu cho từng món
            F('price') * F('quantity'),
            output_field=DecimalField()
        ))
    ).order_by('-total_sold')[:10] # Lấy top 10

    # Thống kê doanh thu theo ngày - Cần nhóm theo ngày
    daily_revenue_queryset = OrderItem.objects.filter(
        order__in=completed_or_delivering_orders_in_period
    ).extra({'order_date': "date(created_date)"}).values('order_date').annotate(
         items_total=Sum(ExpressionWrapper(
            F('price') * F('quantity'),
            output_field=DecimalField()
        ))
    ).order_by('order_date')

    # Thêm phí vận chuyển vào doanh thu theo ngày
    shipping_fee_daily = completed_or_delivering_orders_in_period.extra({'order_date': "date(created_date)"}).values('order_date').annotate(
        shipping_total=Sum('shipping_fee')
    ).order_by('order_date')

    # Kết hợp doanh thu từ item và phí vận chuyển theo ngày
    daily_revenue_dict = {item['order_date']: item['items_total'] for item in daily_revenue_queryset}
    shipping_fee_daily_dict = {item['order_date']: item['shipping_total'] for item in shipping_fee_daily}

    daily_revenue = []
    all_dates = sorted(list(set(daily_revenue_dict.keys()) | set(shipping_fee_daily_dict.keys()))) # Lấy tất cả các ngày có dữ liệu
    for date in all_dates:
        daily_revenue.append({
            'date': date,
            'revenue': (daily_revenue_dict.get(date, Decimal('0')) +
                        shipping_fee_daily_dict.get(date, Decimal('0'))),
        })


    # Thống kê cửa hàng - Chỉ lấy các cửa hàng đã duyệt và active
    # Nếu có store_id được chọn, chỉ lấy cửa hàng đó
    if store_id:
         stores_to_list = Store.objects.filter(id=store_id, is_approved=True, active=True)
    else:
         stores_to_list = Store.objects.filter(is_approved=True, active=True)


    store_stats = []
    for store in stores_to_list:
        store_orders = orders_in_period.filter(store=store)
        store_completed_or_delivering_orders = store_orders.filter(
             status__in=[Order.Status.COMPLETED, Order.Status.DELIVERING]
        )

        store_items_revenue = OrderItem.objects.filter(
            order__in=store_completed_or_delivering_orders
        ).aggregate(
             total=Sum(ExpressionWrapper(
                F('price') * F('quantity'),
                output_field=DecimalField()
            ))
        )['total'] or Decimal('0')

        store_shipping_fee = store_completed_or_delivering_orders.aggregate(
            total=Sum('shipping_fee')
        )['total'] or Decimal('0')

        store_total_revenue = store_items_revenue + store_shipping_fee

        store_reviews = Review.objects.filter(store=store, created_date__gte=start_date)

        store_stats.append({
            'store_name': store.name,
            'total_orders': store_orders.count(), # Tổng đơn hàng trong khoảng thời gian (bao gồm cả pending...)
            'total_revenue': store_total_revenue, # Tổng doanh thu từ đơn đã hoàn thành/giao
            'average_rating': store_reviews.aggregate(avg=Avg('rating'))['avg'] or 0,
            'total_reviews': store_reviews.count(),
            'total_foods': store.foods.count(), # Có thể cần lọc theo active=True nếu cần
            'total_followers': store.followers.count(),
        })

    # Sắp xếp store_stats theo doanh thu giảm dần cho biểu đồ top cửa hàng
    store_stats_sorted_by_revenue = sorted(store_stats, key=lambda x: x['total_revenue'], reverse=True)


    # Thống kê đánh giá
    review_stats = Review.objects.filter(
        created_date__gte=start_date
    ).values('rating').annotate(
        count=Count('id')
    ).order_by('rating') # Sắp xếp theo rating để biểu đồ hiển thị đúng thứ tự sao

    # Chuẩn bị dữ liệu cho biểu đồ đánh giá để đảm bảo có đủ 5 sao ngay cả khi không có đánh giá
    # Tạo dict ban đầu với count = 0 cho tất cả các rating
    review_stats_dict = {rating: {'rating': rating, 'count': 0} for rating, _ in Review.RATING_CHOICES}
    # Cập nhật count từ query result
    for stat in review_stats:
        review_stats_dict[stat['rating']]['count'] = stat['count']
    # Chuyển lại thành list và sắp xếp theo rating
    review_stats_list = sorted(review_stats_dict.values(), key=lambda x: x['rating'])


    context = {
        'stats': stats,
        'top_foods': top_foods,
        'store_stats': store_stats_sorted_by_revenue, # Sử dụng dữ liệu đã sắp xếp cho top cửa hàng
        'order_status_stats': order_status_stats,
        'daily_revenue': daily_revenue,
        'review_stats': review_stats_list, # Sử dụng dữ liệu đã chuẩn bị cho biểu đồ đánh giá
        'period': period,
        'selected_store': store_id,
        'stores': Store.objects.filter(is_approved=True, active=True), # Danh sách cửa hàng cho dropdown filter
        'order_statuses': dict(Order.Status.choices), # Giữ lại nếu cần dùng ở chỗ khác
        'payment_statuses': dict(Payment.Status.choices), # Giữ lại nếu cần dùng ở chỗ khác
    }

    return render(request, 'admin/stats.html', context)

class MenuViewSet(viewsets.GenericViewSet,generics.ListAPIView):
    queryset = Menu.objects.all()
    serializer_class = MenuSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['GET', 'POST'], url_path='my-store',permission_classes=[AllowAny])
    def get_my_store_menus(self, request):
        if request.method == 'GET':
            menus = Menu.objects.filter(store=request.user.account.store)
            serializer = self.get_serializer(menus, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy()
            data['store'] = request.user.account.store.id  # Gán store hiện tại

            serializer = self.get_serializer(data=data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['GET'], url_path='detail', permission_classes=[AllowAny])
    def retrieve_my_store_menu(self, request, pk=None):
        try:
            menu = Menu.objects.get(id=pk)
        except Menu.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(menu)
        return Response(serializer.data)


logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    @action(detail=False, methods=['post'], url_path='momo')
    def create_momo_payment_view(self, request):
        order_id = request.data.get("order_id")

        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        # Use the order's actual total amount to prevent tampering
        amount = int(order.total_amount)

        # Check if payment already exists for this order
        existing_payment = Payment.objects.filter(order=order).first()
        if existing_payment and existing_payment.status == Payment.Status.COMPLETED:
            return Response({
                "error": "Order has already been paid",
                "payment_id": existing_payment.id,
                "status": existing_payment.status
            }, status=status.HTTP_400_BAD_REQUEST)

        # Generate a unique request ID for MoMo
        momo_request_id = str(uuid.uuid4())
        momo_order_id = f"ORDER_{order.id}_{momo_request_id[:8]}"

        try:
            # Call MoMo API
            momo_response = create_momo_payment(
                amount=amount,
                order_info=f"Thanh toán đơn hàng #{order.id}",
                redirect_url="https://yourdomain.com/thank-you",
                ipn_url="https://yourdomain.com/api/payments/momo/webhook",
                momo_request_id=momo_request_id,
                momo_order_id=momo_order_id
            )

            # Check if MoMo response is valid
            if 'payUrl' not in momo_response:
                logger.error(f"Invalid MoMo response: {momo_response}")
                return Response({
                    "error": "Failed to create payment with MoMo",
                    "details": momo_response.get('message', 'Unknown error')
                }, status=status.HTTP_502_BAD_GATEWAY)

            # Create or update the Payment record
            if existing_payment:
                existing_payment.payment_method = Payment.PaymentMethod.MOMO
                existing_payment.status = Payment.Status.PENDING
                existing_payment.transaction_id = momo_order_id  # Store MoMo's order ID
                existing_payment.payment_url = momo_response.get('payUrl')
                existing_payment.save()
                payment = existing_payment
            else:
                payment = Payment.objects.create(
                    order=order,
                    amount=amount,
                    payment_method=Payment.PaymentMethod.MOMO,
                    status=Payment.Status.PENDING,
                    transaction_id=momo_order_id,  # Đây là orderId MoMo sẽ gửi lại
                    payment_url=momo_response.get('payUrl')
                )

            return Response({
                "payUrl": momo_response.get('payUrl'),
                "payment_id": payment.id,
                "status": payment.get_status_display()
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error creating MoMo payment: {str(e)}")
            return Response({
                "error": "Failed to process payment",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CategoryViewSet(viewsets.ViewSet,generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = Category.objects.all()


class StoreStatsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StoreStatsSerializer

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def list(self, request):
        store_id = request.query_params.get('store_id')
        period = request.query_params.get('period', 'month')
        year = request.query_params.get('year')

        if not store_id:
            return Response(
                {"error": "store_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user is store owner or admin
        store = get_object_or_404(Store, id=store_id)
        if not (request.user.is_staff or (hasattr(request.user, 'account') and store.account == request.user.account)):
            return Response(
                {"error": "You don't have permission to view these statistics"},
                status=status.HTTP_403_FORBIDDEN
            )

        stats = get_store_stats(store_id, period, year)
        return Response(stats)


