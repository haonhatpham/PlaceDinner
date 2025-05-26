from django.db.models.signals import post_save
# Import signal post_save: được “phát ra” mỗi khi một instance của model được lưu (create hoặc update)
from django.dispatch import receiver
from .models import Food, Notification,Menu
from .tasks import send_new_dish_notification,send_new_menu_notification


@receiver(post_save, sender=Food)
def notify_followers(sender, instance, created, **kwargs):
    if created:
        followers = instance.store.followers.all()
        for follow in followers:
            # Lưu thông báo vào database
            Notification.objects.create(
                account=follow.customer,
                title=f"Món mới tại {instance.store.name}",
                message=f"{instance.name} - {instance.price}",
                notification_type='NEW_FOOD',
                related_id=instance.id
            )

            # Gửi email thông báo
            if follow.customer.user.email:
                send_new_dish_notification.delay(
                    follow.customer.user.email,
                    instance.name,
                    instance.store.name
                )


# Menu mới
@receiver(post_save, sender=Menu)
def notify_followers_new_menu(sender, instance, created, **kwargs):
    if created:
        followers = instance.store.followers.all()
        for follow in followers:
            Notification.objects.create(
                account=follow.customer,
                title=f"Menu mới tại {instance.store.name}",
                message=f"{instance.name} ({instance.get_menu_type_display()}) đã được thêm!",
                notification_type='NEW_MENU',
                related_id=instance.id
            )
            # Gọi task nếu bạn có (giống như send_new_dish_notification)
            if follow.customer.user.email:
                send_new_menu_notification.delay(
                    follow.customer.user.email,
                    instance.name,
                    instance.store.name
                )