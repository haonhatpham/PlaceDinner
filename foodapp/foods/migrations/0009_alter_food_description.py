# Generated by Django 5.1.6 on 2025-06-04 13:34

import ckeditor.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("foods", "0008_delete_notification"),
    ]

    operations = [
        migrations.AlterField(
            model_name="food",
            name="description",
            field=ckeditor.fields.RichTextField(blank=True, null=True),
        ),
    ]
