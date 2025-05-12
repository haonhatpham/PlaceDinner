from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import viewsets, permissions
from django.core.mail import send_mail
import math
from .services import PaymentService, NotificationService
import paypalrestsdk
import stripe

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