from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import logging
import json
import hmac
import hashlib
from django.conf import settings

from .models import Payment, Order

logger = logging.getLogger(__name__)

# Lấy Secret Key từ settings
# Cần đảm bảo bạn đã cấu hình MOMO_SECRET_KEY trong settings.py
# Ví dụ: MOMO_SECRET_KEY = "Khóa bí mật của bạn"
MOMO_SECRET_KEY = settings.MOMO_SECRET_KEY

@csrf_exempt
@api_view(['POST'])
def momo_webhook_view(request):
    """
    Handle webhook callbacks from MoMo payment system.
    """
    try:
        # === 1. Ghi log raw body ===
        raw_body = request.body.decode('utf-8')
        logger.info(f"[MoMo Webhook] Raw body: {raw_body}")

        data = request.data
        logger.info(f"[MoMo Webhook] Parsed data: {data}")

        # === 2. Kiểm tra chữ ký (Signature Verification) ===
        # Cần đảm bảo các trường này có trong data và theo đúng thứ tự MoMo gửi IPN
        # (Tham khảo tài liệu MoMo về cấu trúc IPN)
        # Các trường thường dùng để tạo signature IPN:
        # partnerCode, accessKey, requestId, amount, orderId, orderInfo,
        # orderType, transId, message, resultCode, responseTime, errorCode, extraData
        # Bạn cần lấy accessKey và partnerCode từ data hoặc settings nếu MoMo gửi
        # Hoặc nếu MoMo không gửi accessKey/partnerCode trong IPN,
        # bạn có thể cần lấy chúng từ settings hoặc từ đơn hàng/payment liên quan
        # Dựa trên các trường có trong data của bạn:
        momo_order_id = data.get("orderId") or data.get("momo_order_id")
        result_code = data.get("resultCode")
        trans_id = data.get("transId")
        amount = data.get("amount")
        message = data.get("message")
        response_time = data.get("responseTime")
        extra_data = data.get("extraData", "") # MoMo có thể gửi extraData rỗng
        request_id = data.get("requestId")
        partner_code = data.get("partnerCode") # MoMo nên gửi partnerCode
        access_key = data.get("accessKey") # MoMo nên gửi accessKey

        # Xác định thứ tự các trường theo tài liệu MoMo IPN
        raw_signature_string = (
            f"partnerCode={partner_code}&accessKey={access_key}&requestId={request_id}&amount={amount}"
            f"&orderId={momo_order_id}&orderInfo={data.get('orderInfo')}&orderType={data.get('orderType')}"
            f"&transId={trans_id}&message={message}&resultCode={result_code}"
            f"&responseTime={response_time}&extraData={extra_data}"
        ) # Kiểm tra lại thứ tự và tên trường với tài liệu MoMo thật sự

        logger.info(f"[MoMo Webhook] Raw signature string for verification: {raw_signature_string}")

        h = hmac.new(
            MOMO_SECRET_KEY.encode('utf-8'),
            raw_signature_string.encode('utf-8'),
            hashlib.sha256
        )
        calculated_signature = h.hexdigest()
        received_signature = data.get("signature")

        logger.info(f"[MoMo Webhook] Calculated signature: {calculated_signature}")
        logger.info(f"[MoMo Webhook] Received signature: {received_signature}")

        if calculated_signature != received_signature:
            logger.error("[MoMo Webhook] Signature verification failed!")
            # Trả về lỗi để MoMo biết IPN không xử lý thành công
            return Response({"error": "Signature verification failed"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("[MoMo Webhook] Signature verification successful.")

        # === 3. Kiểm tra dữ liệu bắt buộc sau khi xác minh chữ ký ===
        if not momo_order_id or result_code is None or trans_id is None:
            missing_fields = []
            if not momo_order_id: missing_fields.append('orderId')
            if result_code is None: missing_fields.append('resultCode')
            if trans_id is None: missing_fields.append('transId')
            logger.error(f"[MoMo Webhook] Missing required data after signature check: {missing_fields}")
            return Response(
                {"error": f"Missing required data: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        momo_order_id = str(momo_order_id)
        payment = None

        # === 4. Tìm payment theo transaction_id (nên là momo_order_id đã lưu) ===
        try:
            # Tìm payment bằng transaction_id đã lưu khi tạo yêu cầu thanh toán
            payment = Payment.objects.get(transaction_id=momo_order_id)
            logger.info(f"[MoMo Webhook] Found payment with transaction_id={momo_order_id}")
        except Payment.DoesNotExist:
             # Fallback tìm theo order ID gốc nếu transaction_id không khớp (ít xảy ra với luồng chuẩn)
            logger.warning(f"[MoMo Webhook] No payment with transaction_id={momo_order_id}, trying order ID fallback")
            order_id_parts = momo_order_id.split('_')
            if order_id_parts and order_id_parts[0].isdigit():
                 try:
                    order_id_int = int(order_id_parts[0])
                    order = Order.objects.get(id=order_id_int)
                    logger.info(f"[MoMo Webhook] Found order with ID={order.id}, searching for linked payment")
                    payment = Payment.objects.filter(order=order).first()
                    if not payment:
                        logger.error(f"[MoMo Webhook] Order {order.id} found but no payment linked")
                        return Response({"error": "Payment not found for order"}, status=status.HTTP_404_NOT_FOUND)
                    logger.info(f"[MoMo Webhook] Found payment {payment.id} via order fallback")
                 except Order.DoesNotExist:
                    logger.error(f"[MoMo Webhook] Order with id={order_id_parts[0]} does not exist for fallback search")
                    return Response({"error": "Order not found for fallback search"}, status=status.HTTP_404_NOT_FOUND)
                 except Exception as fallback_error:
                    logger.exception(f"[MoMo Webhook] Unexpected error during order fallback search: {fallback_error}")
                    return Response({"error": "Error during fallback search"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                logger.error(f"[MoMo Webhook] Invalid orderId format for fallback or no related payment found")
                return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)

        # === 5. Cập nhật trạng thái dựa trên resultCode ===
        try:
            # Chuyển resultCode sang int để so sánh
            result_code_int = int(result_code)

            if result_code_int == 0:
                # Thanh toán thành công
                payment.status = Payment.Status.COMPLETED
                payment.transaction_id = trans_id # Cập nhật transaction_id thật từ MoMo
                payment.payment_date = timezone.now()
                logger.info(f"[MoMo Webhook] Payment {payment.id} (Order {payment.order.id}) status updated to COMPLETED")

                # Cập nhật trạng thái đơn hàng nếu đang PENDING
                order = payment.order
                if order.status == Order.Status.PENDING:
                    order.status = Order.Status.CONFIRMED # Hoặc status khác tùy logic kinh doanh
                    order.save()
                    logger.info(f"[MoMo Webhook] Order {order.id} status updated to CONFIRMED")

            # Bạn có thể thêm các resultCode khác của MoMo để xử lý các trạng thái khác (ví dụ: 1000 - Đang xử lý, >0 - Lỗi)
            # Tham khảo tài liệu MoMo về các mã resultCode
            elif result_code_int > 0: # Các mã lỗi khác
                 payment.status = Payment.Status.FAILED
                 # Có thể lưu resultCode hoặc message từ MoMo vào trường note hoặc trường mới
                 logger.warning(f"[MoMo Webhook] Payment {payment.id} (Order {payment.order.id}) FAILED with resultCode={result_code}. Message: {message}")
            # else: MoMo có thể gửi các trạng thái trung gian, bạn có thể chọn bỏ qua hoặc xử lý

            # Chỉ lưu payment nếu trạng thái thay đổi
            if payment.has_changed: # Bạn có thể cần thêm mixin HasChangedModel vào Payment model
                 payment.save()
            else: # Nếu không có gì thay đổi, vẫn log để biết IPN được nhận
                 logger.info(f"[MoMo Webhook] Payment {payment.id} (Order {payment.order.id}) received IPN but status did not change (current status: {payment.status})")


        except ValueError:
             logger.error(f"[MoMo Webhook] Invalid resultCode format: {result_code}")
             return Response({"error": "Invalid resultCode format"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as update_error:
            logger.exception(f"[MoMo Webhook] Error updating payment or order: {update_error}")
            # Trả về lỗi để MoMo có thể thử lại IPN sau
            return Response({"error": "Internal error during update"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # === 6. Trả về phản hồi thành công cho MoMo ===
        # MoMo yêu cầu response status 200 OK để xác nhận đã nhận IPN thành công
        return Response({"message": "Webhook processed successfully"}, status=status.HTTP_200_OK)

    except json.JSONDecodeError:
        logger.exception("[MoMo Webhook] Invalid JSON body")
        return Response({"error": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception(f"[MoMo Webhook] Unexpected error: {e}")
        return Response({"error": "Unexpected error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
