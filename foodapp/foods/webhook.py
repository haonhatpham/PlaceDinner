from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import logging
import json

from .models import Payment, Order

logger = logging.getLogger(__name__)


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

        # === 2. Kiểm tra dữ liệu bắt buộc ===
        momo_order_id = data.get("orderId") or data.get("momo_order_id")
        result_code = data.get("resultCode")
        trans_id = data.get("transId")

        if not momo_order_id:
            logger.error("[MoMo Webhook] Missing 'orderId'")
            return Response({"error": "Missing orderId"}, status=status.HTTP_400_BAD_REQUEST)

        if result_code is None:
            logger.warning("[MoMo Webhook] resultCode is missing, probably not a real webhook")
            return Response({"message": "Ignored non-webhook call"}, status=status.HTTP_200_OK)

        momo_order_id = str(momo_order_id)
        payment = None

        # === 3. Tìm payment theo transaction_id hoặc order_id ===
        try:
            payment = Payment.objects.get(transaction_id=momo_order_id)
            logger.info(f"[MoMo Webhook] Found payment with transaction_id={momo_order_id}")
        except Payment.DoesNotExist:
            logger.warning(f"[MoMo Webhook] No payment with transaction_id={momo_order_id}")
            if momo_order_id.isdigit():
                try:
                    order = Order.objects.get(id=int(momo_order_id))
                    logger.info(f"[MoMo Webhook] Found order with ID={order.id}")
                    payment = Payment.objects.filter(order=order).first()
                    if not payment:
                        logger.error(f"[MoMo Webhook] Order found but no payment linked")
                        return Response({"error": "Payment not found for order"}, status=status.HTTP_404_NOT_FOUND)
                except Order.DoesNotExist:
                    logger.error(f"[MoMo Webhook] Order with id={momo_order_id} does not exist")
                    return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
            else:
                logger.error(f"[MoMo Webhook] Invalid orderId format or no related payment")
                return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)

        # === 4. Cập nhật trạng thái ===
        try:
            if int(result_code) == 0:
                payment.status = Payment.Status.COMPLETED
                payment.transaction_id = trans_id or momo_order_id
                payment.payment_date = timezone.now()
                payment.save()

                order = payment.order
                if order.status == Order.Status.PENDING:
                    order.status = Order.Status.CONFIRMED
                    order.save()
                    logger.info(f"[MoMo Webhook] Order {order.id} confirmed")

                logger.info(f"[MoMo Webhook] Payment {payment.id} marked as COMPLETED")
            else:
                payment.status = Payment.Status.FAILED
                payment.save()
                logger.warning(f"[MoMo Webhook] Payment {payment.id} FAILED with resultCode={result_code}")

        except Exception as update_error:
            logger.exception(f"[MoMo Webhook] Error updating payment or order: {update_error}")
            return Response({"error": "Internal error during update"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "Webhook processed successfully"}, status=status.HTTP_200_OK)

    except json.JSONDecodeError:
        logger.exception("[MoMo Webhook] Invalid JSON body")
        return Response({"error": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception(f"[MoMo Webhook] Unexpected error: {e}")
        return Response({"error": "Unexpected error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
