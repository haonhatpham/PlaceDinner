import uuid
import hmac
import hashlib
import requests
import logging
import json
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import Payment, Order
from django.utils import timezone

logger = logging.getLogger(__name__)

# Test credentials
TEST_PARTNER_CODE = 'MOMO'
TEST_ACCESS_KEY = 'F8BBA842ECF85'
TEST_SECRET_KEY = 'K951B6PE1waDMi640xX08PD3vg6EkVlz'

@csrf_exempt
@api_view(['POST'])
def create_momo_payment(request):
    """
    Create a payment request to MoMo API
    """
    try:
        # Extract data from request
        data = request.data
        logger.info(f"Received payment request data: {json.dumps(data, indent=2)}")
        
        amount = data.get('amount')
        order_info = data.get('order_info')
        redirect_url = data.get('redirect_url')
        ipn_url = data.get('ipn_url')
        order_id = data.get('orderId')

        # Validate required fields
        if not all([amount, order_info, redirect_url, ipn_url, order_id]):
            missing_fields = []
            if not amount: missing_fields.append('amount')
            if not order_info: missing_fields.append('order_info')
            if not redirect_url: missing_fields.append('redirect_url')
            if not ipn_url: missing_fields.append('ipn_url')
            if not order_id: missing_fields.append('orderId')
            
            logger.error(f"Missing required parameters: {missing_fields}")
            logger.error(f"Received data: {data}")
            return Response(
                {"error": f"Missing required parameters: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get order from database
        try:
            order = Order.objects.get(id=order_id.split('_')[0])  # Lấy ID gốc từ orderId
        except Order.DoesNotExist:
            return Response(
                {"error": "Order not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Use test credentials
        partner_code = TEST_PARTNER_CODE
        access_key = TEST_ACCESS_KEY
        secret_key = TEST_SECRET_KEY

        logger.info(f"Using MoMo test credentials - Partner Code: {partner_code}, Access Key: {access_key}")

        # Generate request ID
        request_id = str(uuid.uuid4())
        request_type = "captureWallet"
        extra_data = ""

        # Create signature
        raw_signature = (
            f"accessKey={access_key}&amount={amount}&extraData={extra_data}"
            f"&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}"
            f"&partnerCode={partner_code}&redirectUrl={redirect_url}"
            f"&requestId={request_id}&requestType={request_type}"
        )

        logger.info(f"Raw signature string: {raw_signature}")

        signature = hmac.new(
            secret_key.encode('utf-8'),
            raw_signature.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        logger.info(f"Generated signature: {signature}")

        # Prepare request data
        momo_data = {
            'partnerCode': partner_code,
            'partnerName': "PlaceDinner",
            'storeId': "PlaceDinnerStore",
            'requestId': request_id,
            'amount': amount,
            'orderId': order_id,
            'orderInfo': order_info,
            'redirectUrl': redirect_url,
            'ipnUrl': ipn_url,
            'lang': "vi",
            'extraData': extra_data,
            'requestType': request_type,
            'signature': signature
        }

        logger.info(f"Sending to MoMo: {json.dumps(momo_data, indent=2)}")

        # Make request to MoMo API
        response = requests.post(
            "https://test-payment.momo.vn/v2/gateway/api/create",
            json=momo_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        # Log response for debugging
        logger.info(f"MoMo response status: {response.status_code}")
        logger.info(f"MoMo response headers: {dict(response.headers)}")
        logger.info(f"MoMo response body: {response.text}")

        if response.status_code != 200:
            error_msg = f"MoMo API error: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return Response(
                {"error": "Failed to create payment", "details": error_msg},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_data = response.json()
        logger.info(f"Parsed MoMo response: {json.dumps(response_data, indent=2)}")

        # Create or update payment record
        payment, created = Payment.objects.get_or_create(
            order=order,
            defaults={
                'amount': amount,
                'status': Payment.Status.PENDING,
                'transaction_id': order_id,
                'payment_url': response_data.get('payUrl'),
                'payment_date': timezone.now()
            }
        )

        if not created:
            payment.status = Payment.Status.PENDING
            payment.transaction_id = order_id
            payment.payment_url = response_data.get('payUrl')
            payment.payment_date = timezone.now()
            payment.save()

        return Response({
            'payUrl': response_data.get('payUrl'),
            'qrCodeUrl': response_data.get('qrCodeUrl'),
            'payment_id': payment.id,
            'status': payment.status
        })

    except requests.exceptions.RequestException as e:
        error_msg = f"Error calling MoMo API: {str(e)}"
        if hasattr(e, 'response') and e.response:
            error_msg += f" - Response: {e.response.text}"
        logger.exception(error_msg)
        return Response(
            {"error": "Failed to create payment", "details": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return Response(
            {"error": "Internal server error", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )