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
            with transaction.atomic():#Đảm bảo xảy ra , không thì không lưu
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                account = serializer.save()

                response_data = serializer.to_representation(account)
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