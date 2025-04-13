from rest_framework import viewsets, generics, permissions, status,parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Account
from .serializers import AccountRegisterSerializer


class UserViewSet(viewsets.ViewSet, generics.CreateAPIView):
    serializer_class = AccountRegisterSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [parsers.MultiPartParser]

    def create(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                account = serializer.save()

                response_data = {
                    'user_id': account.user.id,
                    'account_id': account.id,
                    'role': account.role,
                    'avatar': account.avatar.url if account.avatar else None
                }

                if account.role == Account.Role.STORE:
                    response_data['store_status'] = 'pending_approval'
                    response_data['message'] = 'Đăng ký cửa hàng thành công. Vui lòng chờ admin phê duyệt'
                else:
                    response_data['message'] = 'Đăng ký thành công'

                return Response(response_data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def current_user(self, request):
        account = request.user.account
        serializer = AccountRegisterSerializer(account)
        return Response(serializer.data)