from celery import shared_task
from django.core.mail import send_mail

@shared_task
def send_new_dish_notification(user_email, dish_name, store_name):
    subject = f"Món mới tại {store_name}!"
    message = f"Cửa hàng {store_name} vừa thêm món mới: {dish_name}. Hãy kiểm tra ngay!"
    send_mail(subject, message, 'no-reply@yourdomain.com', [user_email])
