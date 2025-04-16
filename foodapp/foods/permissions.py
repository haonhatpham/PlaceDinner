from rest_framework import permissions


class IsStoreOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # Kiểm tra user đã đăng nhập và có role là STORE
        if request.user.is_authenticated and request.user.account.role == request.user.account.Role.STORE:
            # Nếu object có thuộc tính account (như Store)
            if hasattr(obj, 'account'):
                return obj.account == request.user.account
            # Nếu object có thuộc tính store (như Food)
            elif hasattr(obj, 'store'):
                return obj.store.account == request.user.account
        return False


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.account.role == request.user.account.Role.ADMIN


class IsCustomer(permissions.BasePermission):

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.account.role == request.user.account.Role.CUSTOMER


class IsStoreOwnerOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # Admin có quyền truy cập mọi thứ
        if request.user.is_authenticated and request.user.account.role == request.user.account.Role.ADMIN:
            return True

        # Store Owner chỉ có quyền với cửa hàng của mình
        if request.user.is_authenticated and request.user.account.role == request.user.account.Role.STORE:
            if hasattr(obj, 'account'):
                return obj.account == request.user.account
            elif hasattr(obj, 'store'):
                return obj.store.account == request.user.account

        return False