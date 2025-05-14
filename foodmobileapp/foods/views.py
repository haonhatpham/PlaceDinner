from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import viewsets, permissions, filters, generics
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from .models import Food, Category, Store, Review
from .serializers import FoodSerializer, ReviewSerializer
from .paginators import ItemPaginator
from .permissions import IsStoreOwnerOrAdmin

class FoodViewSet(viewsets.ViewSet, generics.ListAPIView, generics.RetrieveAPIView):
    serializer_class = FoodSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'store']  # Cho phép lọc theo category và store
    search_fields = ['name', 'description']   # Cho phép tìm kiếm theo tên và mô tả
    ordering_fields = ['price', 'created_date']  # Cho phép sắp xếp theo giá và ngày tạo
    permission_classes = [permissions.AllowAny]  # Cho phép tất cả người dùng tìm kiếm
    pagination_class = ItemPaginator

    def get_queryset(self):
        # Sử dụng select_related để tối ưu query
        queryset = Food.objects.filter(is_available=True)\
            .select_related(
                'category',  # Lấy thông tin category
                'store',     # Lấy thông tin store
            )

        # Lọc theo tên (tìm kiếm không phân biệt hoa thường)
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query)
            )

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

        # Lọc theo loại thức ăn (category)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)

        # Lọc theo cửa hàng (store)
        store = self.request.query_params.get('store')
        if store:
            queryset = queryset.filter(store_id=store)

        return queryset

    def get_permissions(self):
        # Chỉ yêu cầu xác thực khi thêm/sửa/xóa món ăn
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsStoreOwnerOrAdmin()]
        return [permissions.AllowAny()]

    @action(detail=True, methods=['get', 'post'], url_path='reviews',
            permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def reviews(self, request, pk=None):
        food = get_object_or_404(Food.objects.select_related('store'), pk=pk)

        if request.method == 'GET':
            # Lấy tất cả reviews với thông tin customer
            reviews = food.reviews.select_related('customer').order_by('-created_date')
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            serializer = ReviewSerializer(data=request.data)
            if serializer.is_valid():
                # Kiểm tra xem người dùng đã đánh giá món này chưa
                existing_review = food.reviews.filter(customer=request.user.account).first()
                if existing_review:
                    return Response(
                        {'error': 'Bạn đã đánh giá món ăn này rồi'},
                        status=400
                    )
                
                serializer.save(customer=request.user.account, food=food)
                
                # Cập nhật lại average_rating của món ăn
                food.update_average_rating()
                
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Lấy danh sách món ăn phổ biến dựa trên số lượng đơn hàng và rating"""
        queryset = self.get_queryset()\
            .annotate(
                order_count=models.Count('order_items'),
                popularity_score=models.F('order_count') * models.F('average_rating')
            )\
            .order_by('-popularity_score')[:10]  # Lấy top 10 món phổ biến
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """Lấy danh sách món ăn từ các cửa hàng gần đây"""
        user_lat = request.query_params.get('latitude')
        user_lng = request.query_params.get('longitude')
        radius = request.query_params.get('radius', 5)  # km

        if not all([user_lat, user_lng]):
            return Response(
                {'error': 'Vui lòng cung cấp tọa độ của bạn'},
                status=400
            )

        # Sử dụng annotation để tính khoảng cách
        from django.contrib.gis.db.models.functions import Distance
        from django.contrib.gis.geos import Point
        user_location = Point(float(user_lng), float(user_lat), srid=4326)
        
        queryset = self.get_queryset()\
            .annotate(
                distance=Distance('store__location', user_location)
            )\
            .filter(
                distance__lte=float(radius) * 1000  # Chuyển km sang mét
            )\
            .order_by('distance')

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recommendations(self, request):
        """Đề xuất món ăn dựa trên lịch sử đơn hàng của người dùng"""
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Vui lòng đăng nhập để xem đề xuất'},
                status=401
            )

        # Lấy các category từ đơn hàng trước đây của user
        user_categories = Category.objects.filter(
            foods__order_items__order__customer=request.user.account
        ).distinct()

        # Lấy các món ăn từ các category đó
        queryset = self.get_queryset()\
            .filter(category__in=user_categories)\
            .exclude(
                order_items__order__customer=request.user.account
            )\
            .order_by('-average_rating')[:10]

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Endpoint tìm kiếm món ăn với các bộ lọc:
        - search: Tìm theo tên/mô tả
        - min_price, max_price: Lọc theo khoảng giá
        - category: Lọc theo loại thức ăn
        - store: Lọc theo cửa hàng
        - ordering: Sắp xếp theo price hoặc created_date
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

class PaymentViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'])
    def create_payment(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk)
        payment_method = request.data.get('payment_method')
        amount = order.total_amount
        
        if payment_method == 'paypal':
            payment_id = PaymentService.create_paypal_payment(amount)
            if payment_id:
                return Response({'payment_url': f'https://www.paypal.com/payment/{payment_id}'})
        elif payment_method == 'stripe':
            client_secret = PaymentService.create_stripe_payment(amount)
            if client_secret:
                return Response({'client_secret': client_secret})
        elif payment_method == 'momo':
            result = PaymentService.create_momo_payment(amount, order.id)
            if result.get('resultCode') == 0:
                return Response({'payment_url': result.get('payUrl')})
        elif payment_method == 'zalopay':
            result = PaymentService.create_zalopay_payment(amount, order.id)
            if result.get('return_code') == 1:
                return Response({'payment_url': result.get('order_url')})
        
        return Response({'error': 'Không thể tạo thanh toán'}, status=400)

    @action(detail=True, methods=['post'])
    def confirm_payment(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk)
        payment_id = request.data.get('payment_id')
        payment_method = request.data.get('payment_method')
        
        # Xác nhận thanh toán từ payment gateway
        if payment_method == 'paypal':
            payment = paypalrestsdk.Payment.find(payment_id)
            if payment.execute({"payer_id": request.data.get('payer_id')}):
                order.status = Order.Status.PAID
                order.save()
                
                # Gửi thông báo
                NotificationService.send_email(
                    order.customer.email,
                    'Thanh toán thành công',
                    f'Đơn hàng #{order.id} của bạn đã được thanh toán thành công.'
                )
                
                return Response({'status': 'success'})
                
        elif payment_method == 'stripe':
            try:
                payment_intent = stripe.PaymentIntent.retrieve(payment_id)
                if payment_intent.status == 'succeeded':
                    order.status = Order.Status.PAID
                    order.save()
                    
                    # Gửi thông báo
                    NotificationService.send_email(
                        order.customer.email,
                        'Thanh toán thành công',
                        f'Đơn hàng #{order.id} của bạn đã được thanh toán thành công.'
                    )
                    
                    return Response({'status': 'success'})
            except Exception as e:
                return Response({'error': str(e)}, status=400)
                
        elif payment_method in ['momo', 'zalopay']:
            # Xác nhận thanh toán từ Momo/ZaloPay
            order.status = Order.Status.PAID
            order.save()
            
            # Gửi thông báo
            NotificationService.send_email(
                order.customer.email,
                'Thanh toán thành công',
                f'Đơn hàng #{order.id} của bạn đã được thanh toán thành công.'
            )
            
            return Response({'status': 'success'})
            
        return Response({'error': 'Không thể xác nhận thanh toán'}, status=400)

class DeliveryFeeViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'])
    def calculate_fee(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)
        distance = request.query_params.get('distance')
        
        # Tính phí vận chuyển dựa trên khoảng cách
        base_fee = 10000  # Phí cơ bản
        distance_fee = float(distance) * 2000  # 2000đ/km
        
        total_fee = base_fee + distance_fee
        
        return Response({
            'store_id': store.id,
            'distance': distance,
            'delivery_fee': total_fee
        })

class NotificationService:
    @staticmethod
    def send_email_notification(user_email, subject, message):
        try:
            send_mail(
                subject,
                message,
                'from@yourdomain.com',
                [user_email],
                fail_silently=False,
            )
            return True
        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    @staticmethod
    def send_sms_notification(phone_number, message):
        # Tích hợp với dịch vụ SMS
        try:
            # Code gửi SMS
            return True
        except Exception as e:
            print(f"Error sending SMS: {e}")
            return False

class StoreLocationViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'])
    def update_location(self, request, pk=None):
        store = get_object_or_404(Store, pk=pk)
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        
        store.latitude = latitude
        store.longitude = longitude
        store.save()
        
        return Response({
            'status': 'success',
            'store': StoreSerializer(store).data
        })

    @action(detail=False, methods=['get'])
    def nearby_stores(self, request):
        user_lat = float(request.query_params.get('latitude'))
        user_lng = float(request.query_params.get('longitude'))
        radius = float(request.query_params.get('radius', 5))  # km
        
        # Tìm các cửa hàng trong bán kính
        stores = Store.objects.filter(
            is_approved=True,
            latitude__isnull=False,
            longitude__isnull=False
        )
        
        nearby_stores = []
        for store in stores:
            distance = self.calculate_distance(
                user_lat, user_lng,
                store.latitude, store.longitude
            )
            if distance <= radius:
                store_data = StoreSerializer(store).data
                store_data['distance'] = distance
                nearby_stores.append(store_data)
        
        return Response(nearby_stores)

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        # Tính khoảng cách giữa 2 điểm theo công thức Haversine
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Bán kính trái đất (km)
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        return round(distance, 2) 