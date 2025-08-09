import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Separator } from './ui/separator';
import { ShoppingCart, DollarSign, TrendingUp, Calendar, Eye, Edit, Trash2, Download, Filter, Search, RefreshCw, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';

const SalesManagement = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  
  // Sale Details Dialog
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  
  // Edit Sale Dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saleForm, setSaleForm] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    items: []
  });

  const { 
    user, 
    getSales, 
    getSaleById,
    updateSale,
    deleteSale,
    getMedicines
  } = useOfflineAuth();

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = () => {
    try {
      const salesList = getSales();
      setSales(salesList);
    } catch (error) {
      showMessage('Error loading sales', 'error');
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const openSaleDetails = (sale) => {
    setSelectedSale(sale);
    setShowSaleDetails(true);
  };

  const openEditDialog = (sale) => {
    setSelectedSale(sale);
    setSaleForm({
      customer_name: sale.customer_name || '',
      customer_phone: sale.customer_phone || '',
      payment_method: sale.payment_method || 'cash',
      items: [...sale.items]
    });
    setShowEditDialog(true);
  };

  const handleEditSale = (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updatedSaleData = {
        customer_name: saleForm.customer_name || undefined,
        customer_phone: saleForm.customer_phone || undefined,
        payment_method: saleForm.payment_method,
        items: saleForm.items,
        total_amount: saleForm.items.reduce((sum, item) => sum + item.total, 0)
      };

      const updatedSale = updateSale(selectedSale.id, updatedSaleData);
      
      if (updatedSale) {
        showMessage('Sale updated successfully', 'success');
        setShowEditDialog(false);
        setSelectedSale(null);
        loadSales();
      } else {
        showMessage('Error updating sale', 'error');
      }
    } catch (error) {
      showMessage('Error updating sale', 'error');
    }
    
    setLoading(false);
  };

  const handleDeleteSale = (saleId, receiptNumber) => {
    if (!window.confirm(`Are you sure you want to delete sale ${receiptNumber}?`)) return;

    try {
      const success = deleteSale(saleId);
      
      if (success) {
        loadSales();
        showMessage('Sale deleted successfully', 'success');
      } else {
        showMessage('Error deleting sale', 'error');
      }
    } catch (error) {
      showMessage('Error deleting sale', 'error');
    }
  };

  const updateSaleItemQuantity = (itemIndex, newQuantity) => {
    if (newQuantity <= 0) {
      const updatedItems = saleForm.items.filter((_, index) => index !== itemIndex);
      setSaleForm({
        ...saleForm,
        items: updatedItems
      });
    } else {
      const updatedItems = saleForm.items.map((item, index) => {
        if (index === itemIndex) {
          const newTotal = item.price * newQuantity;
          return { ...item, quantity: newQuantity, total: newTotal };
        }
        return item;
      });
      setSaleForm({
        ...saleForm,
        items: updatedItems
      });
    }
  };

  // Filter sales based on search and date
  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sale.customer_phone && sale.customer_phone.includes(searchTerm)) ||
      sale.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(item => item.medicine_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    const saleDate = new Date(sale.created_at || sale.sale_date);
    const today = new Date();
    
    switch (dateFilter) {
      case 'today':
        return saleDate >= startOfDay(today) && saleDate <= endOfDay(today);
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return saleDate >= startOfDay(yesterday) && saleDate <= endOfDay(yesterday);
      case 'week':
        const weekAgo = subDays(today, 7);
        return saleDate >= startOfDay(weekAgo);
      case 'month':
        const monthAgo = subDays(today, 30);
        return saleDate >= startOfDay(monthAgo);
      case 'custom':
        const customStart = new Date(customDateRange.start);
        const customEnd = new Date(customDateRange.end);
        return saleDate >= startOfDay(customStart) && saleDate <= endOfDay(customEnd);
      default:
        return true;
    }
  });

  // Calculate statistics
  const stats = {
    totalSales: filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0),
    totalTransactions: filteredSales.length,
    returns: filteredSales.filter(sale => sale.is_return || sale.total_amount < 0),
    avgTransaction: filteredSales.length > 0 ? 
      filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) / filteredSales.length : 0,
    totalItems: filteredSales.reduce((sum, sale) => 
      sum + (sale.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0),
    totalDiscounts: filteredSales.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0)
  };

  const paymentMethodStats = filteredSales.reduce((acc, sale) => {
    const method = sale.payment_method || 'cash';
    acc[method] = (acc[method] || 0) + (sale.total_amount || 0);
    return acc;
  }, {});

  const canEditSales = () => {
    return ['admin', 'manager'].includes(user?.role);
  };

  const formatCurrency = (amount) => `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sales Management</h1>
              <p className="text-slate-600">Track and manage your sales transactions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadSales}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <Alert className={messageType === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
            <AlertDescription className={messageType === 'error' ? 'text-red-700' : 'text-green-700'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Sales</p>
                  <p className="text-3xl font-bold text-green-900">{formatCurrency(stats.totalSales)}</p>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-green-600">{stats.totalTransactions} transactions</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Avg. Transaction</p>
                  <p className="text-3xl font-bold text-blue-900">{formatCurrency(stats.avgTransaction)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUpRight className="w-4 h-4 text-blue-600 mr-1" />
                <span className="text-blue-600">{stats.totalItems} items sold</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700">Returns</p>
                  <p className="text-3xl font-bold text-orange-900">{stats.returns.length}</p>
                </div>
                <ArrowDownRight className="w-8 h-8 text-orange-600" />
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-orange-600">
                  {formatCurrency(stats.returns.reduce((sum, sale) => sum + Math.abs(sale.total_amount), 0))} returned
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Total Discounts</p>
                  <p className="text-3xl font-bold text-purple-900">{formatCurrency(stats.totalDiscounts)}</p>
                </div>
                <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xl">%</span>
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-purple-600">
                  {((stats.totalDiscounts / (stats.totalSales + stats.totalDiscounts)) * 100).toFixed(1)}% discount rate
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method Breakdown */}
        {Object.keys(paymentMethodStats).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(paymentMethodStats).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <span className="font-medium capitalize">{method}</span>
                    <span className="font-bold text-green-600">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Search sales..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                      className="w-40"
                    />
                    <span>to</span>
                    <Input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                      className="w-40"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Transactions ({filteredSales.length})</CardTitle>
            <CardDescription>
              {dateFilter !== 'all' && `Filtered by: ${dateFilter === 'custom' ? 'Custom Range' : dateFilter}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Receipt</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Date & Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Items</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Payment</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Total</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{sale.receipt_number}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-900">
                          {format(new Date(sale.created_at || sale.sale_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-slate-500">
                          {format(new Date(sale.created_at || sale.sale_date), 'hh:mm a')}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {sale.is_return || sale.total_amount < 0 ? (
                          <Badge className="bg-orange-100 text-orange-800">
                            ↩️ Return
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">
                            🛒 Sale
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-900">{sale.customer_name || 'Walk-in'}</div>
                        {sale.customer_phone && (
                          <div className="text-xs text-slate-500">{sale.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openSaleDetails(sale)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium transition-colors"
                        >
                          {sale.items?.length || 0} items
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">
                          {(sale.payment_method || 'cash').toUpperCase()}
                        </Badge>
                        {sale.discount_amount > 0 && (
                          <div className="text-xs text-purple-600 mt-1">
                            -{formatCurrency(sale.discount_amount)} discount
                          </div>
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className={`font-semibold ${
                          sale.is_return || sale.total_amount < 0 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {sale.is_return || sale.total_amount < 0 ? '-' : ''}{formatCurrency(sale.total_amount)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSaleDetails(sale)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEditSales() && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(sale)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSale(sale.id, sale.receipt_number)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredSales.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {searchTerm || dateFilter !== 'all' 
                    ? 'No sales found matching your criteria' 
                    : 'No sales data available. Start making sales in the POS!'
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sale Details Dialog */}
        <Dialog open={showSaleDetails} onOpenChange={setShowSaleDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Sale Details - {selectedSale?.receipt_number}</DialogTitle>
              <DialogDescription>
                Complete transaction information
              </DialogDescription>
            </DialogHeader>
            
            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date & Time</Label>
                    <p className="font-medium">
                      {format(new Date(selectedSale.created_at || selectedSale.sale_date), 'PPP p')}
                    </p>
                  </div>
                  <div>
                    <Label>Transaction Type</Label>
                    <p className="font-medium">
                      {selectedSale.is_return || selectedSale.total_amount < 0 ? 'Return' : 'Sale'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer</Label>
                    <p className="font-medium">{selectedSale.customer_name || 'Walk-in Customer'}</p>
                    {selectedSale.customer_phone && (
                      <p className="text-sm text-slate-600">{selectedSale.customer_phone}</p>
                    )}
                  </div>
                  <div>
                    <Label>Payment Method</Label>
                    <p className="font-medium capitalize">{selectedSale.payment_method || 'cash'}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Items ({selectedSale.items?.length || 0})</Label>
                  <div className="mt-2 space-y-2">
                    {selectedSale.items?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                        <div>
                          <p className="font-medium">{item.medicine_name}</p>
                          <p className="text-sm text-slate-600">
                            {item.quantity} × ₹{item.price} = ₹{item.total}
                            {item.is_return && <span className="text-orange-600 ml-2">(Return)</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  {selectedSale.subtotal_amount && (
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{selectedSale.subtotal_amount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedSale.discount_amount > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Discount ({selectedSale.discount_type === 'percentage' ? `${selectedSale.discount_value}%` : `₹${selectedSale.discount_value}`}):</span>
                      <span>-₹{selectedSale.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className={selectedSale.is_return || selectedSale.total_amount < 0 ? 'text-orange-600' : 'text-green-600'}>
                      {selectedSale.is_return || selectedSale.total_amount < 0 ? '-' : ''}₹{Math.abs(selectedSale.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Sale Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Sale - {selectedSale?.receipt_number}</DialogTitle>
              <DialogDescription>
                Update sale information (Admin/Manager only)
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEditSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={saleForm.customer_name}
                    onChange={(e) => setSaleForm({...saleForm, customer_name: e.target.value})}
                    placeholder="Customer name (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Phone</Label>
                  <Input
                    value={saleForm.customer_phone}
                    onChange={(e) => setSaleForm({...saleForm, customer_phone: e.target.value})}
                    placeholder="Phone number (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={saleForm.payment_method} onValueChange={(value) => setSaleForm({...saleForm, payment_method: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Items</Label>
                <div className="space-y-2">
                  {saleForm.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{item.medicine_name}</p>
                        <p className="text-sm text-slate-600">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateSaleItemQuantity(index, item.quantity - 1)}
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateSaleItemQuantity(index, item.quantity + 1)}
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold">₹{item.total.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-bold">
                  Total: ₹{saleForm.items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setSelectedSale(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Sale'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SalesManagement;