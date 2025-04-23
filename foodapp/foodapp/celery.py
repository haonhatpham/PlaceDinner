from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Đặt biến môi trường cho Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tên_dự_án.settings')

app = Celery('tên_dự_án')

# Nạp cấu hình từ Django settings, sử dụng namespace 'CELERY'
app.config_from_object('django.conf:settings', namespace='CELERY')

# Tự động phát hiện các task trong các ứng dụng đã cài đặt
app.autodiscover_tasks()
