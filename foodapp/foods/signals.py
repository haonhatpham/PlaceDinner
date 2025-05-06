from django.db.models.signals import post_save
# Import signal post_save: được “phát ra” mỗi khi một instance của model được lưu (create hoặc update)
from django.dispatch import receiver
from .models import Food, Notification,Menu
from .tasks import send_new_dish_notification,send_new_menu_notification


@receiver(post_save, sender=Food)
# Dùng decorator @receiver để “lắng nghe” signal post_save phát ra từ model Food.
# Khi có một Food mới được lưu, Django sẽ gọi hàm ngay bên dưới.
def notify_followers(sender, instance, created, **kwargs):
    # Hàm xử lý được gọi khi signal post_save được kích hoạt.
    if created:
        # Lấy tất cả user đang theo dõi cửa hàng của món ăn này
        followers = instance.store.followers.all()
        for user in followers:
            # Lưu thông báo vào database
            Notification.objects.create(
                account=user,
                title=f"Món mới tại {instance.store.name}",
                message=f"{instance.name} - {instance.price}",
                notification_type='NEW_FOOD',
                related_id=instance.id
            )

            send_new_dish_notification.delay(user.email, instance.name, instance.store.name)
            # Gọi Celery task bất đồng bộ:  .delay(...) đẩy job vào queue, worker sẽ lấy ra xử lý gửi email/SMS.


# Menu mới
@receiver(post_save, sender=Menu)
def notify_followers_new_menu(sender, instance, created, **kwargs):
    if created:
        followers = instance.store.followers.all()
        for user in followers:
            Notification.objects.create(
                account=user,
                title=f"Menu mới tại {instance.store.name}",
                message=f"{instance.name} ({instance.get_menu_type_display()}) đã được thêm!",
                notification_type='NEW_MENU',
                related_id=instance.id
            )
            # Gọi task nếu bạn có (giống như send_new_dish_notification)
            send_new_menu_notification.delay(user.email, instance.name, instance.store.name)