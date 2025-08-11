import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Calendar, CalendarDaysIcon, TrendingUp, TrendingDown, ShoppingCart, Package, DollarSign, Users, BarChart3, PieChart, Activity, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie,
  LineChart, Line, ComposedChart, Legend
} from 'recharts';
import { format, subDays, parseISO, isValid } from 'date-fns';
import axios from 'axios';

// Get backend URL from environment
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [medicinesSoldData, setMedicinesSoldData] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [medicineStockHistory, setMedicineStockHistory] = useState([]);
  const [error, setError] = useState('');

  // API configuration
  const API_URL = `${BACKEND_URL}/api`;

  const mockAnalyticsData = mockSalesData.length > 0 ? processAnalyticsData(mockSalesData) : {
    total_sales: 125430.50,
    total_transactions: 1248,
    total_items_sold: 3420,
    top_selling_medicines: [
      { medicine_id: '1', name: 'Paracetamol 500mg', quantity: 450, revenue: 2250.00 },
      { medicine_id: '2', name: 'Amoxicillin 250mg', quantity: 320, revenue: 4800.00 },
      { medicine_id: '3', name: 'Vitamin D3', quantity: 280, revenue: 8400.00 },
      { medicine_id: '4', name: 'Aspirin 75mg', quantity: 250, revenue: 1250.00 },
      { medicine_id: '5', name: 'Omeprazole 20mg', quantity: 200, revenue: 3000.00 }
    ],
    daily_sales: [
      { date: '2025-01-01', sales: 3200 },
      { date: '2025-01-02', sales: 4100 },
      { date: '2025-01-03', sales: 3800 },
      { date: '2025-01-04', sales: 4500 },
      { date: '2025-01-05', sales: 3900 },
      { date: '2025-01-06', sales: 5200 },
      { date: '2025-01-07', sales: 4800 }
    ],
    payment_method_breakdown: {
      cash: 45230.25,
      card: 38120.15,
      upi: 42080.10
    },
    hourly_sales_pattern: Array.from({length: 24}, (_, i) => ({
      hour: i,
      sales: Math.random() * 3000 + 500
    }))
  };

  const mockMedicinesSold = mockSalesData.length > 0 ? 
    Object.values(mockSalesData.reduce((acc, sale) => {
      sale.items.forEach(item => {
        if (!acc[item.medicine_id]) {
          acc[item.medicine_id] = {
            medicine_id: item.medicine_id,
            medicine_name: item.medicine_name,
            total_quantity_sold: 0,
            total_revenue: 0,
            average_price: item.price,
            sale_count: 0
          };
        }
        acc[item.medicine_id].total_quantity_sold += item.quantity;
        acc[item.medicine_id].total_revenue += item.total;
        acc[item.medicine_id].sale_count += 1;
      });
      return acc;
    }, {})).sort((a, b) => b.total_quantity_sold - a.total_quantity_sold) : 
    [
      { medicine_id: '1', medicine_name: 'Paracetamol 500mg', total_quantity_sold: 450, total_revenue: 2250.00, average_price: 5.00, sale_count: 90 },
      { medicine_id: '2', medicine_name: 'Amoxicillin 250mg', total_quantity_sold: 320, total_revenue: 4800.00, average_price: 15.00, sale_count: 64 },
      { medicine_id: '3', medicine_name: 'Vitamin D3', total_quantity_sold: 280, total_revenue: 8400.00, average_price: 30.00, sale_count: 56 },
      { medicine_id: '4', medicine_name: 'Aspirin 75mg', total_quantity_sold: 250, total_revenue: 1250.00, average_price: 5.00, sale_count: 50 },
      { medicine_id: '5', medicine_name: 'Omeprazole 20mg', total_quantity_sold: 200, total_revenue: 3000.00, average_price: 15.00, sale_count: 40 }
    ];

  const getMockStockHistory = (medicineId) => {
    return mockStockMovements
      .filter(movement => movement.medicine_id === medicineId)
      .slice(-10) // Get last 10 movements
      .map(movement => ({
        date: format(movement.created_at, 'MMM dd'),
        movement_type: movement.movement_type,
        quantity_change: movement.quantity_change,
        previous_stock: movement.previous_stock,
        new_stock: movement.new_stock,
        notes: movement.notes
      }));
  };

  useEffect(() => {
    fetchAnalyticsData();
    fetchMedicinesSoldData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // In real implementation, this would be an API call
      // const response = await axios.post(`${API_URL}/analytics/sales`, {
      //   start_date: dateRange.start,
      //   end_date: dateRange.end
      // });
      
      // For now, using mock data
      setTimeout(() => {
        setAnalyticsData(mockAnalyticsData);
        setLoading(false);
      }, 1000);
    } catch (error) {
      setError('Failed to fetch analytics data');
      setLoading(false);
    }
  };

  const fetchMedicinesSoldData = async () => {
    try {
      // In real implementation:
      // const response = await axios.get(`${API_URL}/analytics/medicines-sold-summary?days=30`);
      
      setMedicinesSoldData(mockMedicinesSold);
    } catch (error) {
      console.error('Failed to fetch medicines sold data', error);
    }
  };

  const fetchMedicineStockHistory = async (medicineId) => {
    try {
      // In real implementation:
      // const response = await axios.get(`${API_URL}/analytics/stock-history/${medicineId}?days=30`);
      
      const mockStockHistory = getMockStockHistory(medicineId);
      setMedicineStockHistory(mockStockHistory);
    } catch (error) {
      console.error('Failed to fetch stock history', error);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  // Prepare chart data
  const pieChartData = analyticsData ? 
    Object.entries(analyticsData.payment_method_breakdown).map(([method, amount]) => ({
      name: method.toUpperCase(),
      value: amount
    })) : [];

  const dailySalesChartData = analyticsData?.daily_sales?.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'MMM dd')
  })) || [];

  const hourlySalesData = analyticsData?.hourly_sales_pattern?.map(item => ({
    ...item,
    time: `${item.hour}:00`
  })) || [];

  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
              <p className="text-slate-600">Comprehensive insights into your pharmacy operations</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Date Range Controls */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Date Range Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date">From:</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="end-date">To:</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="w-40"
                />
              </div>
              <Button onClick={fetchAnalyticsData} disabled={loading}>
                {loading ? 'Loading...' : 'Update Analytics'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total Sales</p>
                    <p className="text-3xl font-bold text-blue-900">{formatCurrency(analyticsData.total_sales)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-600" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-green-600">12.5% from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Transactions</p>
                    <p className="text-3xl font-bold text-green-900">{analyticsData.total_transactions.toLocaleString()}</p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-green-600" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-green-600">8.2% from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Items Sold</p>
                    <p className="text-3xl font-bold text-purple-900">{analyticsData.total_items_sold.toLocaleString()}</p>
                  </div>
                  <Package className="w-8 h-8 text-purple-600" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-green-600">15.8% from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700">Avg. Transaction</p>
                    <p className="text-3xl font-bold text-orange-900">
                      {formatCurrency(analyticsData.total_sales / analyticsData.total_transactions)}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-orange-600" />
                </div>
                <div className="mt-2 flex items-center text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-green-600">5.3% from last month</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Section */}
        <Tabs defaultValue="sales-trends" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales-trends">Sales Trends</TabsTrigger>
            <TabsTrigger value="top-medicines">Top Medicines</TabsTrigger>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="stock-analysis">Stock Analysis</TabsTrigger>
          </TabsList>

          {/* Sales Trends Tab */}
          <TabsContent value="sales-trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Sales Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Daily Sales Revenue
                  </CardTitle>
                  <CardDescription>Sales performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailySalesChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#dbeafe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hourly Sales Pattern */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Hourly Sales Pattern
                  </CardTitle>
                  <CardDescription>Sales distribution throughout the day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlySalesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="sales" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Top Medicines Tab */}
          <TabsContent value="top-medicines" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Top Selling Medicines by Quantity
                </CardTitle>
                <CardDescription>Best performing products in your inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analyticsData?.top_selling_medicines || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#3b82f6" name="Quantity Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payment-methods" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Payment Method Distribution
                  </CardTitle>
                  <CardDescription>Revenue breakdown by payment method</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Method Summary</CardTitle>
                  <CardDescription>Detailed breakdown of payment methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pieChartData.map((item, index) => {
                      const percentage = ((item.value / analyticsData.total_sales) * 100).toFixed(1);
                      return (
                        <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(item.value)}</p>
                            <p className="text-sm text-slate-600">{percentage}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stock Analysis Tab */}
          <TabsContent value="stock-analysis" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Medicine Selection for Stock History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Stock Movement Analysis
                  </CardTitle>
                  <CardDescription>Select a medicine to view its stock movement history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select onValueChange={(value) => {
                      setSelectedMedicine(value);
                      fetchMedicineStockHistory(value);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a medicine to analyze" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicinesSoldData.map((medicine) => (
                          <SelectItem key={medicine.medicine_id} value={medicine.medicine_id}>
                            {medicine.medicine_name} (Sold: {medicine.total_quantity_sold})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedMedicine && medicineStockHistory.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold mb-4">Stock Movement History</h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={medicineStockHistory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="new_stock" fill="#10b981" name="Stock Level" />
                            <Line 
                              type="monotone" 
                              dataKey="quantity_change" 
                              stroke="#ef4444" 
                              name="Quantity Change"
                              strokeWidth={2}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Medicines Sold Summary Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Complete Medicines Sold Summary
            </CardTitle>
            <CardDescription>Detailed breakdown of all products with quantities sold</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Medicine Name</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Quantity Sold</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Revenue</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Avg. Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Sale Count</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {medicinesSoldData.map((medicine, index) => (
                    <tr key={medicine.medicine_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-8 rounded-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
                          <span className="font-medium">{medicine.medicine_name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-blue-600">
                        {medicine.total_quantity_sold}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-green-600">
                        {formatCurrency(medicine.total_revenue)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatCurrency(medicine.average_price)}
                      </td>
                      <td className="text-right py-3 px-4 text-slate-600">
                        {medicine.sale_count}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={index < 3 ? 'default' : 'secondary'} className={
                          index < 3 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                        }>
                          {index < 3 ? 'Top Seller' : 'Regular'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;