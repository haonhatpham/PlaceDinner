from django.db.models import Sum, Count, F, Q
from django.db.models.functions import TruncYear, TruncQuarter, TruncMonth
from .models import Order, OrderItem, Category, Food
from django.db.models import ExpressionWrapper, DecimalField

def get_store_stats(store_id, period="month", year=None):
    time_map = {
        "year": TruncYear,
        "quarter": TruncQuarter,
        "month": TruncMonth,
    }
    trunc_func = time_map.get(period, TruncMonth)

    # Filter completed orders for the specific store
    orders = Order.objects.filter(
        store_id=store_id,
        status=Order.Status.COMPLETED,
    )

    # Filter by year if provided
    if year is not None:
         orders = orders.filter(created_date__year=year)

    # Calculate total revenue and order count by the specified time period
    # We need to aggregate item revenue and shipping fee separately and then sum them.

    # 1. Aggregate item revenue per period from OrderItems
    item_revenue_by_period = OrderItem.objects.filter(order__in=orders) \
        .annotate(period=trunc_func('order__created_date')) \
        .values('period') \
        .annotate(
            total_item_revenue=Sum(ExpressionWrapper(
                F('quantity') * F('price'),
                output_field=DecimalField()
            ))
        ) \
        .order_by('period')

    # 2. Aggregate shipping fee per period from Orders
    shipping_fee_by_period = orders \
        .annotate(period=trunc_func('created_date')) \
        .values('period') \
        .annotate(total_shipping_fee=Sum('shipping_fee')) \
        .order_by('period')

    # 3. Combine item revenue and shipping fee, and count orders
    # This requires joining the two aggregated querysets based on the period.
    # A simpler approach within a single queryset is often possible.
    # Let's try a single queryset approach again, focusing on direct sums after grouping.

    revenue_stats = orders.annotate(period=trunc_func('created_date'))
    revenue_stats = revenue_stats.values('period')
    revenue_stats = revenue_stats.annotate(
        # Calculate total revenue for the period directly
        total_revenue=Sum(
            ExpressionWrapper(
                F('items__quantity') * F('items__price'),
                output_field=DecimalField()
            ) # Sum of item revenue for all items in orders of this period
        ) + Sum('shipping_fee'), # Sum of shipping fees for all orders of this period
        total_orders=Count('id')
    )
    revenue_stats = revenue_stats.order_by('period')

    # Thống kê sản phẩm bán chạy
    # Aggregate product stats per period
    product_stats = (
        OrderItem.objects.filter(order__in=orders) \
        .annotate(period=trunc_func('order__created_date')) \
        .values(
            'food__name',
            'food__category__name',
            'period'
        ) \
        .annotate(
            total_sold=Sum('quantity'),
            # Calculate revenue per product item for the period
            revenue=Sum(
                ExpressionWrapper(
                    F('quantity') * F('price'),
                    output_field=DecimalField()
                )
            )
        ) \
        .order_by('period', '-total_sold') # Order by period and then by total_sold descending
    )

    # Get all categories associated with the store's foods
    all_store_categories = Category.objects.filter(food__store_id=store_id).distinct().values('id', 'name')

    return {
        "revenue": list(revenue_stats),
        "products": list(product_stats),
        "categories": list(all_store_categories) # Include all categories
    }