# Generated by Django 5.1.6 on 2025-04-21 16:53

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("foods", "0002_category_food_notification_order_orderitem_review_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="store",
            name="is_active",
        ),
    ]
