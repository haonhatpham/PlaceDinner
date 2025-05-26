from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@shared_task
def send_new_dish_notification(user_email, dish_name, store_name):
    try:
        logger.info(f"Bắt đầu gửi thông báo đến {user_email} cho món {dish_name}")

        subject = f"Món mới tại {store_name}!"
        message = f"Cửa hàng {store_name} vừa thêm món mới: {dish_name}. Hãy kiểm tra ngay!"

        send_mail(
            subject,
            message,
            settings.EMAIL_HOST_USER,
            [user_email],
            fail_silently=False,
        )

        logger.info(f"Đã gửi thông báo món mới tới {user_email}")
        return True

    except Exception as e:
        logger.error(f"Lỗi gửi thông báo món mới đến {user_email}: {str(e)}")
        return False


@shared_task
def send_new_menu_notification(email, menu_name, store_name):
    try:
        subject = f"Menu mới tại {store_name}!"
        message = f"Cửa hàng {store_name} vừa cập nhật menu mới: {menu_name}. Hãy kiểm tra ngay!"

        send_mail(
            subject,
            message,
            settings.EMAIL_HOST_USER,
            [email],
            fail_silently=False,
        )

        logger.info(f"Đã gửi thông báo menu mới tới {email}")
        return True

    except Exception as e:
        logger.error(f"Lỗi gửi thông báo menu mới: {str(e)}")
        return False