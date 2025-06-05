import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    Alert
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { getStoreStatistics } from './statisticsService';
import { formatCurrency } from './formatters';
import { MyUserContext } from '../../configs/Contexts'; // Assuming your User Context is here

const screenWidth = Dimensions.get('window').width;

const StoreStatsScreen = ({ route }) => {
    const { storeId: navStoreId } = route.params || {}; // Get storeId from navigation params if available
    const user = useContext(MyUserContext); // Get user from context

    // Determine the store ID to use: navigation param takes precedence, then user's store
    const storeId = navStoreId || user?.store?.id;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState('month');
    const [year, setYear] = useState(new Date().getFullYear());
    const [stats, setStats] = useState(null);

    const fetchStats = async () => {
        if (!storeId) {
            setError('Store ID is not available.');
            setLoading(false);
            return;
        }
        // Optional: Check if the logged-in user has permission to view stats for this storeId
        // This check should also be done on the backend, but a frontend check improves UX.
        // You might need more user/store data in the context for a robust frontend check.
        // For now, we rely on the backend for definitive authorization.

        try {
            setLoading(true);
            setError(null);
            const data = await getStoreStatistics(storeId, period, year);
            setStats(data);
        } catch (err) {
            console.error("Fetch stats error:", err);
            // Handle error response from backend if it's not just a message
            const errorMessage = err.response?.data?.detail || err.message || 'Không thể tải dữ liệu thống kê.';
            setError(errorMessage);
            Alert.alert('Lỗi', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch stats only if a storeId is available
        if (storeId) {
           fetchStats();
        } else if (!navStoreId && user && !user.store) {
             // User is logged in but not a store owner, and no storeId was provided via navigation
            setError('You do not own a store to view statistics.');
            setLoading(false);
        } else if (!user && !navStoreId) {
             // User is not logged in and no storeId was provided via navigation
            setError('Please log in to view store statistics.');
            setLoading(false);
        }
    }, [storeId, period, year, user]); // Depend on user as well, in case context changes

    const renderRevenueChart = () => {
        if (!stats?.revenue || stats.revenue.length === 0) return <Text style={styles.noDataText}>Không có dữ liệu doanh thu.</Text>;

        const labels = stats.revenue.map(item => {
            const date = item.period ? new Date(item.period) : null; // Handle potential null period
            let label = '';
            if (date) {
                 label = period === 'month' ? date.toLocaleDateString('vi-VN', { month: 'short' }) :
                    period === 'quarter' ? `Q${Math.floor(date.getMonth() / 3) + 1}` :
                    String(date.getFullYear()); // Ensure year is string
            } else {
                label = 'N/A'; // Default label if period is null
            }
            return String(label); // Ensure the generated label is always a string
        });

        const dataValues = stats.revenue.map(item => parseFloat(item.total_revenue) || 0); // Convert to float, default to 0 if invalid

        const data = {
            labels: labels,
            datasets: [{
                data: dataValues
            }]
        };

         const chartConfig = {
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
                borderRadius: 16
            },
             propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: "#ffa726"
            }
        };


        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Doanh thu theo thời gian</Text>
                 <ScrollView horizontal>
                    <LineChart
                        data={data}
                        width={Math.max(screenWidth - 40, data.labels.length * 50)} // Adjust width based on number of labels
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                    />
                 </ScrollView>
            </View>
        );
    };

    const renderProductStats = () => {
        if (!stats?.products || stats.products.length === 0) return <Text style={styles.noDataText}>Không có dữ liệu sản phẩm bán chạy.</Text>;

        // Aggregate product data by name for the chart
        const productAggregation = stats.products.reduce((acc, item) => {
            const productName = item.food__name; // Use the correct backend field name
            if (productName) { // Ensure product name is not null or undefined
                 if (!acc[productName]) {
                    acc[productName] = 0;
                 }
                acc[productName] += parseFloat(item.total_sold) || 0; // Ensure total_sold is a number
            }
            return acc;
        }, {});

        const aggregatedProducts = Object.keys(productAggregation).map(name => ({
            name: name,
            total_sold: productAggregation[name]
        }));

        // Sort by total_sold descending and take top N (e.g., top 5)
        const sortedProducts = aggregatedProducts.sort((a, b) => b.total_sold - a.total_sold).slice(0, 5);

        const labels = sortedProducts.map(item => String(item.name)); // Ensure labels are strings
        const dataValues = sortedProducts.map(item => parseFloat(item.total_sold) || 0); // Ensure data is numbers

        const data = {
            labels: labels,
            datasets: [{
                data: dataValues
            }]
        };

         const chartConfig = {
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
             labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
                borderRadius: 16
            },
        };

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Top 5 sản phẩm bán chạy</Text>
                 <ScrollView horizontal>
                    <BarChart
                        data={data}
                         width={Math.max(screenWidth - 40, data.labels.length * 70)} // Adjust width
                        height={220}
                        chartConfig={chartConfig}
                        style={styles.chart}
                         fromZero // Start y-axis from zero
                    />
                 </ScrollView>
            </View>
        );
    };

    const renderCategoryStats = () => {
        // Now we use stats.categories for the full list, and stats.products for aggregation
        if (!stats?.categories || stats.categories.length === 0) return <Text style={styles.noDataText}>Không có dữ liệu danh mục nào cho cửa hàng này.</Text>;

        // Aggregate product data by category name from stats.products for quick lookup
        const categorySalesMap = stats.products.reduce((acc, item) => {
            const categoryName = item.food__category__name; // Use the correct backend field name
            if (categoryName) { // Ensure category name is not null or undefined
                if (!acc[categoryName]) {
                    acc[categoryName] = { total_sold: 0, revenue: 0 };
                }
                acc[categoryName].total_sold += parseFloat(item.total_sold) || 0; // Ensure total_sold is a number
                acc[categoryName].revenue += parseFloat(item.revenue) || 0; // Ensure revenue is a number
            }
            return acc;
        }, {});

        // Combine all categories with their aggregated stats (or 0 if no sales)
        const allCategoriesWithStats = stats.categories.map(category => {
            const aggregatedStats = categorySalesMap[category.name] || { total_sold: 0, revenue: 0 };
            return {
                name: category.name, // Category name from the full list
                total_sold: aggregatedStats.total_sold,
                revenue: aggregatedStats.revenue
            };
        });

        // Sort by revenue descending (or by name if revenue is same, or just by name)
        const sortedCategories = allCategoriesWithStats.sort((a, b) => b.revenue - a.revenue);

        // Prepare data for Bar Chart
        const labels = sortedCategories.map(category => String(category.name)); // Ensure labels are strings
        const dataValues = sortedCategories.map(category => parseFloat(category.revenue) || 0); // Ensure data is numbers

        // Handle case where there are categories but no sales data for the period
         if (dataValues.every(value => value === 0)) {
             return (
                 <View style={styles.chartContainer}> {/* Reuse chartContainer style */}
                    <Text style={styles.chartTitle}>Doanh thu theo danh mục</Text>
                    <Text style={styles.noDataText}>Không có doanh thu cho bất kỳ danh mục nào trong kỳ này.</Text>
                 </View>
             );
         }


        const data = {
            labels: labels,
            datasets: [{
                data: dataValues
            }]
        };

         const chartConfig = {
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0, // Adjust as needed for revenue display on chart
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`, // Blue color for bars
             labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
                borderRadius: 16
            },
             formatYLabel: (yLabel) => formatCurrency(parseFloat(yLabel), false) // Format Y-axis labels as currency
        };

        return (
            <View style={styles.chartContainer}> {/* Reuse chartContainer style */}
                <Text style={styles.chartTitle}>Doanh thu theo danh mục</Text>
                 <ScrollView horizontal> {/* Allow horizontal scrolling for many categories */}
                    <BarChart
                        data={data}
                         width={Math.max(screenWidth - 40, data.labels.length * 80)} // Adjust width based on number of labels
                        height={220}
                        chartConfig={chartConfig}
                        style={styles.chart} // Reuse chart style
                         fromZero // Start y-axis from zero
                         showValuesOnTopOfBars={true} // Show revenue values on top of bars (optional)
                         // withCustomBarColorFromData={true}
                         // flatColor={true}
                    />
                 </ScrollView>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text>Đang tải thống kê...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Lỗi: {error}</Text>
                {!storeId && <Text style={styles.errorText}>Không thể xác định cửa hàng để hiển thị thống kê.</Text>}
            </View>
        );
    }

    // Ensure stats and stats.revenue exist before calculating total revenue and orders
    const totalRevenue = stats?.revenue?.reduce((sum, item) => sum + (parseFloat(item?.total_revenue) || 0), 0) || 0; // Handle potential null/undefined item or total_revenue
    const totalOrders = stats?.revenue?.reduce((sum, item) => sum + (item?.total_orders || 0), 0) || 0; // Handle potential null/undefined item or total_orders

    return (
        <ScrollView style={styles.container}>
            <View style={styles.periodSelector}>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'month' && styles.activePeriod]}
                    onPress={() => setPeriod('month')}
                >
                    <Text style={[styles.periodButtonText, period === 'month' && styles.activePeriodText]}>Tháng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'quarter' && styles.activePeriod]}
                    onPress={() => setPeriod('quarter')}
                >
                    <Text style={[styles.periodButtonText, period === 'quarter' && styles.activePeriodText]}>Quý</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.periodButton, period === 'year' && styles.activePeriod]}
                    onPress={() => setPeriod('year')}
                >
                    <Text style={[styles.periodButtonText, period === 'year' && styles.activePeriodText]}>Năm</Text>
                </TouchableOpacity>
            </View>
             {/* Optional Year Selector - You might want to add a dropdown or input for the year */}
            {/* <View style={styles.yearSelector}> */}
            {/*    <Text>Năm:</Text> */}
            {/*    <TextInput */}
            {/*        style={styles.yearInput} */}
            {/*        keyboardType="numeric" */}
            {/*        value={year.toString()} */}
            {/*        onChangeText={(text) => setYear(parseInt(text) || new Date().getFullYear())} */}
            {/*    /> */}
            {/* </View> */}

            {renderRevenueChart()}
            {renderProductStats()}
            {renderCategoryStats()}

            <View style={styles.summaryContainer}>
                <Text style={styles.summaryTitle}>Tổng quan</Text>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Tổng doanh thu:</Text>
                    <Text style={styles.summaryValue}>
                        {formatCurrency(totalRevenue)}
                    </Text>
                </View>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Tổng đơn hàng:</Text>
                    <Text style={styles.summaryValue}>
                        {totalOrders}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 10,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
     errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        margin: 10,
    },
     noDataText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
        color: '#666',
    },
    periodSelector: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 5,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 15,
        elevation: 1,
    },
    periodButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 5,
    },
    activePeriod: {
        backgroundColor: '#007AFF',
    },
    periodButtonText: {
        color: '#333',
        fontSize: 14,
        fontWeight: 'bold',
    },
     activePeriodText: {
        color: '#fff',
    },
     yearSelector: {
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'center',
         backgroundColor: '#fff',
         padding: 10,
         borderRadius: 8,
         marginBottom: 15,
         elevation: 1,
     },
     yearInput: {
         marginLeft: 10,
         borderBottomWidth: 1,
         borderColor: '#ccc',
         padding: 5,
         width: 80,
         textAlign: 'center',
     },
    chartContainer: {
        backgroundColor: '#fff',
        marginVertical: 10,
        padding: 10,
        borderRadius: 10,
        elevation: 2,
        overflow: 'hidden', // Needed for horizontal ScrollView on charts
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: '#333',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    summaryContainer: {
        backgroundColor: '#fff',
        marginVertical: 10,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
         paddingBottom: 5,
         borderBottomWidth: 1,
         borderBottomColor: '#eee',
    },
     summaryLabel: {
        fontSize: 16,
        color: '#555',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    statsSectionContainer: { // Keep this style for the container view
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        elevation: 1,
    },
});

export default StoreStatsScreen; 