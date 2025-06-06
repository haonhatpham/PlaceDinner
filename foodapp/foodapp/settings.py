"""
Django settings for foodapp project.

Generated by 'django-admin startproject' using Django 5.2.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/5.2/ref/settings/
"""

from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

MEDIA_ROOT = '%s/foods/static/' % BASE_DIR


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-$@%j3g5ade&)fzca0$2p(3g11y#^yn$xc@-0bm83@tkwb4swj6"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.100.86','192.168.100.22','192.168.1.11','192.168.1.8']  # IP máy tính bạn

# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "foods.apps.FoodsConfig",
    "rest_framework",
    "drf_yasg", #Swagger UI
    "oauth2_provider",
    'celery',
    'django_celery_results',
    'django_celery_beat',
    'ckeditor',
    'ckeditor_uploader'
]
CKEDITOR_UPLOAD_PATH = "ckeditors/images/"

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ( 'oauth2_provider.contrib.rest_framework.OAuth2Authentication',)
}

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

# Configuration
cloudinary.config(
    cloud_name="dtcxjo4ns",
    api_key="878131591311564",
    api_secret="HBzMY618mgiGZH_jVqoKab22m9A",  # Click 'View API Keys' above to copy your API secret
    secure=True
)

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "foodapp.urls"
import os

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "foodapp.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'fooddb',
        'USER': 'root',
        'PASSWORD': '1234',
        'HOST': ''  # mặc định localhost
    }
}

AUTH_USER_MODEL = 'foods.User'

import pymysql
pymysql.install_as_MySQLdb()


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Ho_Chi_Minh"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = "static/"

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

OAUTH2_PROVIDER = { 'OAUTH2_BACKEND_CLASS': 'oauth2_provider.oauth2_backends.JSONOAuthLibCore' }

CLIENT_ID= '9tlx4eMbkTHpH7SJrJdgr2kmkn8UtcCTuQNx1yiX'
CLIENT_SECRET = 'Pq2u9U7URcJd27LTMU5bCJ12mDk7HjZ0ztxYU2sSVGxGn8J68nOQwAjXyHsinNdqTuULlfvN3XCeoCDkgGeDLBeCWtrBX0vwHDL442HkfdfVUr6e80EsZUIqhGtWJa6R'
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB, có thể tăng nữa nếu cần

# Cấu hình Redis làm broker cho Celery
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'

# Cấu hình Celery
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Ho_Chi_Minh'

CLIENT_ID_Hao= 'TpHW7RxLEyEw41LWSeRQVqYADyqDPJQPocKm9YW8'
CLIENT_SECRET_Hao="Yskk6I2YlLK8Yu6Nhfn1Kf6LvWzg0fHoRH7Fj79HPRID5PtswU3azGnjC6HqOMBguWdHIpq1DGo9zcfNbxoUjvkE8COj3aMi1XPWWKFkuNoA7BXJrKgG3dyhnWSU03If"


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'thongbaocuahang@gmail.com'
EMAIL_HOST_PASSWORD = 'awoq uxis jtdb dyca'
DEFAULT_FROM_EMAIL = 'thongbaocuahang@gmail.com'

MOMO_SECRET_KEY = "K951B6PE1waDMi640xX08PD3vg6EkVlz"
USE_TZ = False