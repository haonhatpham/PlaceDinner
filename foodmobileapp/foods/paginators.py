from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

class ItemPaginator(PageNumberPagination):
    page_size = 10  # Số item mỗi trang
    page_size_query_param = 'page_size'  # Cho phép client chỉ định số item mỗi trang
    max_page_size = 100  # Giới hạn số item tối đa mỗi trang

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,  # Tổng số item
            'next': self.get_next_link(),        # Link trang tiếp theo
            'previous': self.get_previous_link(), # Link trang trước
            'results': data                       # Dữ liệu của trang hiện tại
        }) 