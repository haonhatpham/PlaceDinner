from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.utils.deprecation import MiddlewareMixin
import jwt
from datetime import datetime, timedelta

class TokenMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # Bỏ qua middleware cho các route không cần xác thực
        if request.path in ['/api/token/', '/api/token/refresh/', '/api/register/']:
            return None

        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        try:
            # Lấy token từ header
            token = auth_header.split(' ')[1]
            
            # Giải mã token
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            
            # Kiểm tra thời gian hết hạn
            exp = datetime.fromtimestamp(payload['exp'])
            if datetime.now() > exp:
                # Token hết hạn, thử refresh
                refresh_token = request.COOKIES.get('refresh_token')
                if refresh_token:
                    try:
                        refresh = RefreshToken(refresh_token)
                        new_token = str(refresh.access_token)
                        request.META['HTTP_AUTHORIZATION'] = f'Bearer {new_token}'
                    except TokenError:
                        return None
                else:
                    return None
            
            # Lưu thông tin user vào request
            request.user_id = payload['user_id']
            
        except (IndexError, jwt.InvalidTokenError):
            return None

        return None 