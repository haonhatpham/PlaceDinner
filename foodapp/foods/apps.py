from django.apps import AppConfig


class FoodsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "foods"

    def ready(self):
        import foods.signals  # 👈 import để kích hoạt signal