from __future__ import absolute_import, unicode_literals

# Đảm bảo Celery được nạp khi Django khởi động
from .celery import app as celery_app

__all__ = ('celery_app',)
