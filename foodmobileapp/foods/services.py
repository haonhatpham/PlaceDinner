from django.conf import settings
import stripe
import paypalrestsdk
from twilio.rest import Client
import requests
import hmac
import hashlib
import json
from datetime import datetime

# Khởi tạo các client
stripe.api_key = settings.STRIPE_SECRET_KEY
paypalrestsdk.configure({
    "mode": "sandbox",
    "client_id": settings.PAYPAL_CLIENT_ID,
    "client_secret": settings.PAYPAL_CLIENT_SECRET
})
twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

class PaymentService:
    @staticmethod
    def create_paypal_payment(amount, currency='USD'):
        payment = paypalrestsdk.Payment({
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "transactions": [{
                "amount": {
                    "total": str(amount),
                    "currency": currency
                },
                "description": "Thanh toán đơn hàng"
            }]
        })
        
        if payment.create():
            return payment.id
        return None

    @staticmethod
    def create_stripe_payment(amount, currency='usd'):
        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Stripe tính bằng cents
                currency=currency
            )
            return payment_intent.client_secret
        except Exception as e:
            print(f"Stripe error: {e}")
            return None

    @staticmethod
    def create_momo_payment(amount, order_id):
        endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
        partner_code = settings.MOMO_ACCESS_KEY
        access_key = settings.MOMO_SECRET_KEY
        order_info = f"Thanh toan don hang {order_id}"
        redirect_url = "https://your-domain.com/payment/momo/callback"
        ipn_url = "https://your-domain.com/payment/momo/ipn"
        
        # Tạo chuỗi ký tự để ký
        raw_hash = f"partnerCode={partner_code}&accessKey={access_key}&requestId={order_id}&amount={amount}&orderId={order_id}&orderInfo={order_info}&redirectUrl={redirect_url}&ipnUrl={ipn_url}&extraData="
        
        # Tạo chữ ký
        h = hmac.new(access_key.encode(), raw_hash.encode(), hashlib.sha256)
        signature = h.hexdigest()
        
        # Tạo request data
        data = {
            'partnerCode': partner_code,
            'accessKey': access_key,
            'requestId': order_id,
            'amount': amount,
            'orderId': order_id,
            'orderInfo': order_info,
            'redirectUrl': redirect_url,
            'ipnUrl': ipn_url,
            'extraData': '',
            'requestType': 'captureWallet',
            'signature': signature
        }
        
        # Gửi request
        response = requests.post(endpoint, json=data)
        return response.json()

    @staticmethod
    def create_zalopay_payment(amount, order_id):
        endpoint = "https://sandbox.zalopay.com.vn/v001/tpe/createorder"
        app_id = settings.ZALOPAY_APP_ID
        key1 = settings.ZALOPAY_KEY1
        key2 = settings.ZALOPAY_KEY2
        
        # Tạo dữ liệu giao dịch
        trans_data = {
            "app_id": app_id,
            "app_time": int(datetime.now().timestamp() * 1000),
            "app_trans_id": f"{datetime.now().strftime('%y%m%d')}_{order_id}",
            "app_user": "user123",
            "amount": amount,
            "item": json.dumps([{"id": order_id, "name": "Thanh toan don hang"}])
        }
        
        # Tạo chữ ký
        data = f"{app_id}|{trans_data['app_trans_id']}|{trans_data['app_user']}|{trans_data['amount']}|{trans_data['app_time']}|{trans_data['item']}"
        trans_data['mac'] = hmac.new(key1.encode(), data.encode(), hashlib.sha256).hexdigest()
        
        # Gửi request
        response = requests.post(endpoint, json=trans_data)
        return response.json()

class NotificationService:
    @staticmethod
    def send_sms(phone_number, message):
        try:
            message = twilio_client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone_number
            )
            return message.sid
        except Exception as e:
            print(f"Twilio error: {e}")
            return None

    @staticmethod
    def send_email(to_email, subject, message):
        try:
            from django.core.mail import send_mail
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER,
                [to_email],
                fail_silently=False,
            )
            return True
        except Exception as e:
            print(f"Email error: {e}")
            return False 