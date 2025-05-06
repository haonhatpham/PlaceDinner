from django.db.models import Sum, Count, F, Q
from django.db.models.functions import TruncYear, TruncQuarter, TruncMonth
from .models import Order, OrderItem

def get_store_stats(store_id, period="month", year=None):
    time_map = {
        "year": TruncYear,
        "quarter": TruncQuarter,
        "month": TruncMonth,
    }
    trunc_func = time_map.get(period, TruncMonth)

    orders = Order.objects.filter(
        store_id=store_id,
        status=Order.Status.COMPLETED,
        created_date__year=year if year else None
    )

    # Thống kê doanh thu theo thời gian
    revenue_stats = (
        orders.annotate(period=trunc_func("created_date"))
        .values("period")
        .annotate(
            total_revenue=Sum("total_amount"),
            total_orders=Count("id")
        )
        .order_by("period")
    )

    # Thống kê sản phẩm bán chạy
    product_stats = (
        OrderItem.objects.filter(order__in=orders)
        .annotate(period=trunc_func("order__created_date"))
        .values("period", "food__name", "food__category__name")
        .annotate(
            total_sold=Sum("quantity"),
            revenue=Sum(F("quantity") * F("price"))
        )
        .order_by("period")
    )

    return {
        "revenue": list(revenue_stats),
        "products": list(product_stats)
    }