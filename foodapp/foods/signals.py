from django.db.models.signals import post_save
# Import signal post_save: được "phát ra" mỗi khi một instance của model được lưu (create hoặc update)
from django.dispatch import receiver
from .models import Food,Menu
from .tasks import send_new_dish_notification,send_new_menu_notification
from celery import group
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Food)
def notify_followers(sender, instance, created, **kwargs):
    if created:
        try:
            followers = instance.store.followers.all()
            notification_tasks = []
            
            for follow in followers:
                # Tạo thông báo trong database
                # notification = Notification.objects.create(
                #     account=follow.customer,
                #     title=f"Món mới tại {instance.store.name}",
                #     message=f"{instance.name} - {instance.price}",
                #     notification_type='NEW_FOOD',
                #     related_id=instance.id
                # )
                
                # Thêm task gửi email vào danh sách
                if follow.customer.user.email:
                    notification_tasks.append(
                        send_new_dish_notification.s(
                            follow.customer.user.email,
                            instance.name,
                            instance.store.name
                        )
                    )
            
            # Chạy tất cả các task gửi email song song
            if notification_tasks:
                job = group(notification_tasks)
                job.apply_async()
                
            logger.info(f"Đã tạo thông báo và gửi email cho {len(followers)} follower của cửa hàng {instance.store.name}")
            
        except Exception as e:
            logger.error(f"Lỗi khi gửi thông báo món mới: {str(e)}")
            # Không raise exception để không ảnh hưởng đến việc tạo món ăn


# Menu mới
@receiver(post_save, sender=Menu)
def notify_followers_new_menu(sender, instance, created, **kwargs):
    if created:
        followers = instance.store.followers.all()
        for follow in followers:
            # Notification.objects.create(
            #     account=follow.customer,
            #     title=f"Menu mới tại {instance.store.name}",
            #     message=f"{instance.name} ({instance.get_menu_type_display()}) đã được thêm!",
            #     notification_type='NEW_MENU',
            #     related_id=instance.id
            # )
            # Gọi task nếu bạn có (giống như send_new_dish_notification)
            if follow.customer.user.email:
                send_new_menu_notification.delay(
                    follow.customer.user.email,
                    instance.name,
                    instance.store.name
                )