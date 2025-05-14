import uuid
import hmac
import hashlib
import requests
import logging

from .models import Payment

# Set up logger
logger = logging.getLogger(__name__)


def create_momo_payment(amount, order_info, redirect_url, ipn_url, momo_request_id=None, momo_order_id=None):
    """
    Create a payment request to MoMo API
    """
    endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
    partner_code = "MOMO"
    access_key = "F8BBA842ECF85"
    secret_key = "K951B6PE1waDMi640xX08PD3vg6EkVlz"

    # Use provided IDs or generate new ones
    request_id = momo_request_id or str(uuid.uuid4())
    order_id = momo_order_id or str(uuid.uuid4())
    request_type = "captureWallet"
    extra_data = ""

    # Create signature
    raw_signature = (
        f"accessKey={access_key}&amount={amount}&extraData={extra_data}"
        f"&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}"
        f"&partnerCode={partner_code}&redirectUrl={redirect_url}"
        f"&requestId={request_id}&requestType={request_type}"
    )

    signature = hmac.new(
        secret_key.encode('ascii'),
        raw_signature.encode('ascii'),
        hashlib.sha256
    ).hexdigest()

    # Prepare request data
    data = {
        'partnerCode': partner_code,
        'partnerName': "Test",
        'storeId': "MomoTestStore",
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

    try:
        response = requests.post(
            endpoint,
            json=data,
            headers={'Content-Type': 'application/json'},
            timeout=10  # Set a timeout to avoid hanging
        )
        response.raise_for_status()  # Raise exception for HTTP errors
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.exception(f"Error calling MoMo API: {str(e)}")
        raise Exception(f"Failed to connect to payment gateway: {str(e)}")