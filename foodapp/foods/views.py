import uuid

from django.views.decorators.csrf import csrf_exempt
from rest_framework import viewsets, generics, permissions, status, parsers
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db import transaction
from .serializers import *
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import *
from .permissions import *
from django.core.mail import send_mail
from rest_framework.generics import get_object_or_404, RetrieveAPIView, UpdateAPIView
from django.db.models import Q
from django.views.generic import View
from django.contrib.auth import logout
from django.shortcuts import render, redirect
from django.db.models import Sum, F
from .momo import create_momo_payment
from django.utils import timezone
import logging

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
class FoodViewSet(viewsets.ViewSet, generics.ListAPIView, generics.RetrieveAPIView):
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
    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
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


class StoreViewSet(viewsets.ViewSet, generics.ListAPIView):
    queryset = Store.objects.filter(is_approved=True)
    serializer_class = StoreSerializer
    permission_classes = [permissions.AllowAny]

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

    @action(detail=True, methods=['get'], url_path='revenue/food/(?P<food_id>[^/.]+)/month')
    def revenue_food_month(self, request, pk=None, food_id=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))
            month = int(request.query_params.get('month'))

            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year,
                created_date__month=month
            )

            total_revenue = 0
            total_orders = 0

            for order in orders:
                items = order.items.filter(food_id=food_id)
                if items.exists():
                    total_orders += 1
                    for item in items:
                        total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "food_id": food_id,
                "month": month,
                "year": year,
                "total_orders": total_orders,
                "revenue": total_revenue
            })
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/food/(?P<food_id>[^/.]+)/year')
    def revenue_food_year(self, request, pk=None, food_id=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))

            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year
            )

            total_revenue = 0
            total_orders = 0

            for order in orders:
                items = order.items.filter(food_id=food_id)
                if items.exists():
                    total_orders += 1
                    for item in items:
                        total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "food_id": food_id,
                "year": year,
                "total_orders": total_orders,
                "total_revenue": total_revenue
            })
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/food/(?P<food_id>[^/.]+)/quarter')
    def revenue_food_quarter(self, request, pk=None, food_id=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))
            quarter = int(request.query_params.get('quarter'))

            if quarter == 1:
                start_month, end_month = 1, 3
            elif quarter == 2:
                start_month, end_month = 4, 6
            elif quarter == 3:
                start_month, end_month = 7, 9
            elif quarter == 4:
                start_month, end_month = 10, 12
            else:
                return Response({'error': 'Quý không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year,
                created_date__month__gte=start_month,
                created_date__month__lte=end_month
            )

            total_revenue = 0
            total_orders = 0

            for order in orders:
                items = order.items.filter(food_id=food_id)
                if items.exists():
                    total_orders += 1
                    for item in items:
                        total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "food_id": food_id,
                "year": year,
                "quarter": quarter,
                "total_orders": total_orders,
                "revenue": total_revenue
            })
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/month')
    def revenue_month(self, request, pk=None):
        try:
            store = Store.objects.get(pk=pk)

            year = int(request.query_params.get('year'))
            month = int(request.query_params.get('month'))

            # Lọc đơn hàng đã hoàn thành trong tháng và năm
            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year,
                created_date__month=month
            )

            # Tính tổng doanh thu
            total_revenue = 0
            for order in orders:
                for item in order.items.all():
                    total_revenue += item.quantity * item.price

            # Trả về kết quả
            return Response({
                "store": store.name,
                "month": month,
                "year": year,
                "total_orders": orders.count(),
                "total_revenue": total_revenue
            })
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/year')
    def revenue_year(self, request, pk=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))

            # Lọc các đơn hàng đã hoàn thành trong năm
            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year
            )

            total_orders = orders.count()
            total_revenue = 0

            for order in orders:
                for item in order.items.all():
                    total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "year": year,
                "total_orders": total_orders,
                "total_revenue": total_revenue
            })

        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/quarter')
    def revenue_quarter(self, request, pk=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))
            quarter = int(request.query_params.get('quarter'))

            # Xác định tháng bắt đầu và kết thúc theo quý
            if quarter == 1:
                start_month, end_month = 1, 3
            elif quarter == 2:
                start_month, end_month = 4, 6
            elif quarter == 3:
                start_month, end_month = 7, 9
            elif quarter == 4:
                start_month, end_month = 10, 12
            else:
                return Response({'error': 'Quý không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

            # Lọc các đơn hàng đã hoàn thành trong quý
            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year,
                created_date__month__gte=start_month,
                created_date__month__lte=end_month
            )

            total_orders = orders.count()
            total_revenue = 0

            for order in orders:
                for item in order.items.all():
                    total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "year": year,
                "quarter": quarter,
                "total_orders": total_orders,
                "total_revenue": total_revenue
            })

        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/category/(?P<category_id>[^/.]+)/year')
    def revenue_category_year(self, request, pk=None, category_id=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))

            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year
            )

            total_revenue = 0
            total_orders = 0

            for order in orders:
                items = order.items.filter(food__category_id=category_id)
                order_total = sum(item.quantity * item.price for item in items)
                if order_total > 0:
                    total_orders += 1
                    total_revenue += order_total

            return Response({
                "store": store.name,
                "category_id": category_id,
                "year": year,
                "total_orders": total_orders,
                "total_revenue": total_revenue
            })
        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'], url_path='revenue/category/(?P<category_id>[^/.]+)/month')
    def revenue_category_month(self, request, pk=None, category_id=None):
        try:
            store = Store.objects.get(pk=pk)
            year = int(request.query_params.get('year'))
            month = int(request.query_params.get('month'))

            # Lấy tất cả các Order đã hoàn thành của cửa hàng trong tháng và năm
            orders = Order.objects.filter(
                store=store,
                status=Order.Status.COMPLETED,
                created_date__year=year,
                created_date__month=month,
                items__food__category_id=category_id  # liên kết qua OrderItem -> Food -> Category
            ).distinct()

            # Tính tổng số đơn
            total_orders = orders.count()

            # Tính tổng doanh thu từ các OrderItem thuộc category
            total_revenue = 0
            for order in orders:
                for item in order.items.filter(food__category_id=category_id):
                    total_revenue += item.quantity * item.price

            return Response({
                "store": store.name,
                "category_id": category_id,
                "year": year,
                "month": month,
                "total_orders": total_orders,
                "total_revenue": total_revenue
            })

        except Store.DoesNotExist:
            return Response({'error': 'Không tìm thấy cửa hàng'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=['get'], url_path='my-store', permission_classes=[permissions.IsAuthenticated])
    def my_store(self, request):
        # GET /stores/my-store/ → Lấy thông tin cửa hàng của user(là chủ cửa hàng)
        store = request.user.store
        serializer = self.get_serializer(store)
        return Response(serializer.data)
    # Chủ cửa hàng lấy danh sách món ăn và tạo món ăn mới
    @action(detail=False, methods=['get', 'post'], url_path='my-store/foods',
            permission_classes=[permissions.IsAuthenticated, IsStoreOwner])
    def my_store_foods(self, request):
        if request.method == 'GET':
            foods = Food.objects.filter(store=request.user.store)
            serializer = FoodSerializer(foods, many=True)
            return Response(serializer.data)
        # POST
        serializer = FoodSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(store=request.user.store)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'put', 'patch', 'delete'], url_path='my-store/foods/(?P<food_id>[^/.]+)',
            permission_classes=[permissions.IsAuthenticated, IsStoreOwner])
    def my_store_food_detail(self, request, food_id=None):
        try:
            food = Food.objects.get(pk=food_id, store=request.user.store)
        except Food.DoesNotExist:
            return Response({"detail": "Không tìm thấy món."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'GET':
            serializer = FoodSerializer(food)
            return Response(serializer.data)
        if request.method in ('PUT', 'PATCH'):
            serializer = FoodSerializer(food, data=request.data, partial=(request.method == 'PATCH'))
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # DELETE
        food.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get', 'post'], url_path='my-store/menus',
            permission_classes=[permissions.IsAuthenticated, IsStoreOwner])
    def my_store_menus(self, request):
        """GET /stores/my-store/menus/ & POST create menu for current user's store"""
        if request.method == 'GET':
            menus = Menu.objects.filter(store=request.user.store)
            serializer = MenuSerializer(menus, many=True)
            return Response(serializer.data)
        serializer = MenuSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(store=request.user.store)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'put', 'patch', 'delete'],
            url_path='my-store/menus/(?P<menu_id>[^/.]+)',
            permission_classes=[permissions.IsAuthenticated, IsStoreOwner])
    def my_store_menu_detail(self, request, menu_id=None):
        """Handle retrieve/update/delete a menu of current user's store"""
        try:
            menu = Menu.objects.get(pk=menu_id, store=request.user.store)
        except Menu.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'GET':
            return Response(MenuSerializer(menu).data)
        if request.method in ('PUT', 'PATCH'):
            serializer = MenuSerializer(menu, data=request.data, partial=(request.method == 'PATCH'))
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        menu.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["patch"], url_path="my-store/orders/(?P<order_id>[^/.]+)/confirm")
    def confirm_order(self, request, order_id=None):
        try:
            order = Order.objects.get(pk=order_id, store=request.user.store)
        except Order.DoesNotExist:
            return Response({"error": "Không tìm thấy đơn hàng."}, status=404)

        if order.status != Order.Status.PENDING:
            return Response({"error": "Chỉ xác nhận đơn đang chờ."}, status=400)

        order.status = Order.Status.CONFIRMED
        order.save()
        return Response({"message": "Đã xác nhận đơn hàng.", "status": order.status})

    @action(detail=False, methods=["patch"], url_path="my-store/orders/(?P<order_id>[^/.]+)/deliver")
    def deliver_order(self, request, order_id=None):
        try:
            order = Order.objects.get(pk=order_id, store=request.user.store)
        except Order.DoesNotExist:
            return Response({"error": "Không tìm thấy đơn hàng."}, status=404)

        if order.status != Order.Status.CONFIRMED:
            return Response({"error": "Chỉ giao đơn đã được xác nhận."}, status=400)

        order.status = Order.Status.COMPLETED
        order.save()
        return Response({"message": "Đã giao hàng thành công.", "status": order.status})
class ReviewDetailView(viewsets.ViewSet, generics.UpdateAPIView, generics.DestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        review = get_object_or_404(Review, pk=self.kwargs['pk'])
        if review.customer != self.request.user.account:
            raise permissions.PermissionDenied("Bạn không có quyền sửa hoặc xoá review này.")
        return review


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



class OrderViewSet(viewsets.ViewSet,generics.CreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]  #Cho khách hàng đặt món

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'store'):
            # Store owner chỉ xem đơn thuộc về store của họ
            return Order.objects.filter(store=user.store)
        # Customer chỉ xem đơn của chính họ
        return Order.objects.filter(customer=user)

    @action(detail=False, methods=['get'], url_path='my-orders')
    def my_orders(self, request):
        orders = Order.objects.filter(customer=request.user)
        return Response(self.get_serializer(orders, many=True).data)

    @action(detail=True, methods=["patch"], url_path="confirm")
    def update_status(self, request, pk=None):
        order = self.get_object()

        # Kiểm tra nếu trạng thái là PENDING, thì chuyển sang CONFIRMED
        if order.status == Order.Status.PENDING:
            order.status = Order.Status.CONFIRMED
        else:
            return Response({"error": "Chỉ có thể cập nhật từ trạng thái PENDING sang CONFIRMED."},
                            status=status.HTTP_400_BAD_REQUEST)

        order.save()
        return Response({"message": "Cập nhật trạng thái thành công.", "status": order.status})

    @action(detail=True, methods=["patch"], url_path="deliver")
    def deliver_order(self, request, pk=None):
        order = self.get_object()
        # if order.status != Order.Status.CONFIRMED:
        #     return Response({"error": "Chỉ giao đơn đã được xác nhận."}, status=400)
        order.status = Order.Status.COMPLETED
        order.save()
        return Response({"message": "Đơn đã giao thành công."})

from .dao import get_store_stats
# Cho Admin Dashboard (Web)
def admin_stats_view(request):
    time_unit = request.GET.get("time_unit", "month")
    store_id = request.GET.get("store_id")
    stores = Store.objects.all()

    stats = get_store_stats(store_id, time_unit) if store_id else {}

    return render(request, "admin/stats.html", {
        "stores": stores,
        "selected_store": store_id,
        "time_unit": time_unit,
        "revenue_data": stats.get("revenue", []),
        "product_data": stats.get("products", [])
    })



# ==========Testing==========================================================
class LogoutView(View):
    def get(self, request):
        logout(request)
        return redirect('app:home')


class HomeView(View):
    template_name = 'login/home.html'

    def get(self, request):
        current_user = request.user
        return render(request, self.template_name, {'current_user': current_user})

class MenuViewSet(viewsets.ViewSet,generics.CreateAPIView):
    queryset = Menu.objects.all()
    serializer_class = MenuSerializer
    permission_classes = [permissions.IsAuthenticated]


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


