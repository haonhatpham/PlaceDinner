from django.db.models.signals import post_save
#Import signal post_save: được “phát ra” mỗi khi một instance của model được lưu (create hoặc update)
from django.dispatch import receiver
from .models import Food
from .tasks import send_new_dish_notification


@receiver(post_save, sender=Food)
# Dùng decorator @receiver để “lắng nghe” signal post_save phát ra từ model Food.
# Khi có một Food mới được lưu, Django sẽ gọi hàm ngay bên dưới.
def notify_followers(sender, instance, created, **kwargs):
    # Hàm xử lý được gọi khi signal post_save được kích hoạt.
    if created:
        followers = instance.store.followers.all()
        # Lấy tất cả user đang theo dõi cửa hàng của món ăn này
        for user in followers:
            send_new_dish_notification.delay(user.email, instance.name, instance.store.name)
            #Gọi Celery task bất đồng bộ:  .delay(...) đẩy job vào queue, worker sẽ lấy ra xử lý gửi email/SMS.
