from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import logging

from .models import Payment, Order

logger = logging.getLogger(__name__)


@csrf_exempt
@api_view(['POST'])
def momo_webhook_view(request):
    """
    Handle webhook callbacks from MoMo payment system.
    """
    try:
        data = request.data
        logger.info(f"[MoMo Webhook] Received data: {data}")

        # === 1. Kiểm tra dữ liệu đầu vào ===
        momo_order_id = data.get("orderId")
        if momo_order_id is not None:
            momo_order_id = str(momo_order_id)
        result_code = data.get("resultCode")
        trans_id = data.get("transId")

        if not momo_order_id:
            logger.error("[MoMo Webhook] Missing 'orderId' in request data")
            return Response({"error": "Missing orderId"}, status=status.HTTP_400_BAD_REQUEST)

        if result_code is None:
            logger.error("[MoMo Webhook] Missing 'resultCode'")
            return Response({"error": "Missing resultCode"}, status=status.HTTP_400_BAD_REQUEST)

        # === 2. Tìm Payment bằng transaction_id ===
        payment = None
        try:
            # First try to find payment with the MoMo orderId as transaction_id
            payment = Payment.objects.get(transaction_id=momo_order_id)
            logger.info(f"[MoMo Webhook] Found payment with transaction_id={momo_order_id}")
        except Payment.DoesNotExist:
            logger.warning(f"[MoMo Webhook] No payment with transaction_id={momo_order_id}")

            # === 3. Nếu transaction_id không khớp, thử bằng order_id (chuyển thành số) ===
            if momo_order_id.isdigit():
                try:
                    order = Order.objects.get(id=int(momo_order_id))
                    logger.info(f"[MoMo Webhook] Found order with ID={order.id}")

                    payment = Payment.objects.filter(order=order).first()
                    if not payment:
                        logger.error(f"[MoMo Webhook] Order found but no payment linked to it")
                        return Response({"error": "Payment not found for this order"}, status=status.HTTP_404_NOT_FOUND)
                except Order.DoesNotExist:
                    logger.error(f"[MoMo Webhook] Order with id={momo_order_id} does not exist")
                    return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
            else:
                logger.error(f"[MoMo Webhook] Invalid orderId format or Payment not found")
                return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)

        # === 4. Cập nhật trạng thái thanh toán ===
        try:
            if int(result_code) == 0:
                payment.status = Payment.Status.COMPLETED
                # Save the transId from MoMo or keep the original orderId if transId is None
                payment.transaction_id = trans_id or momo_order_id
                payment.payment_date = timezone.now()

                order = payment.order
                if order.status == Order.Status.PENDING:
                    order.status = Order.Status.CONFIRMED
                    order.save()
                    logger.info(f"[MoMo Webhook] Order {order.id} confirmed")

                logger.info(f"[MoMo Webhook] Payment {payment.id} completed successfully")
            else:
                payment.status = Payment.Status.FAILED
                logger.warning(f"[MoMo Webhook] Payment {payment.id} failed with result_code={result_code}")

            payment.save()
        except Exception as e:
            logger.exception(f"[MoMo Webhook] Error when updating payment or order: {e}")
            return Response({"error": "Internal error when updating payment"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"message": "Webhook processed successfully"}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception(f"[MoMo Webhook] Unexpected error: {e}")
        return Response({"error": "Unexpected error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)