# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID = 'your-account-sid'
TWILIO_AUTH_TOKEN = 'your-auth-token'
TWILIO_PHONE_NUMBER = 'your-twilio-phone'

# OAuth2 Configuration
OAUTH2_PROVIDER = {
    'ACCESS_TOKEN_EXPIRE_SECONDS': 3600,  # 1 hour
    'REFRESH_TOKEN_EXPIRE_SECONDS': 2592000,  # 30 days
    'ROTATE_REFRESH_TOKEN': True,
}

# Payment Gateway Configuration
PAYPAL_CLIENT_ID = 'your-paypal-client-id'
PAYPAL_CLIENT_SECRET = 'your-paypal-secret'

STRIPE_PUBLIC_KEY = 'your-stripe-public-key'
STRIPE_SECRET_KEY = 'your-stripe-secret-key'

MOMO_ACCESS_KEY = 'your-momo-access-key'
MOMO_SECRET_KEY = 'your-momo-secret-key'

ZALOPAY_APP_ID = 'your-zalopay-app-id'
ZALOPAY_KEY1 = 'your-zalopay-key1'
ZALOPAY_KEY2 = 'your-zalopay-key2' 