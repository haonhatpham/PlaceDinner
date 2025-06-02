from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging
from celery.exceptions import MaxRetriesExceededError
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_new_dish_notification(self, user_email, dish_name, store_name):
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

    except Exception as exc:
        logger.error(f"Lỗi gửi thông báo món mới đến {user_email}: {str(exc)}")
        try:
            # Thử gửi lại sau 60 giây
            self.retry(exc=exc)
        except MaxRetriesExceededError:
            logger.error(f"Đã vượt quá số lần thử lại cho email {user_email}")
            return False
        return False


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_new_menu_notification(self, email, menu_name, store_name):
    try:
        logger.info(f"Bắt đầu gửi thông báo menu mới đến {email}")

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

    except Exception as exc:
        logger.error(f"Lỗi gửi thông báo menu mới đến {email}: {str(exc)}")
        try:
            # Thử gửi lại sau 60 giây
            self.retry(exc=exc)
        except MaxRetriesExceededError:
            logger.error(f"Đã vượt quá số lần thử lại cho email {email}")
            return False
        return False