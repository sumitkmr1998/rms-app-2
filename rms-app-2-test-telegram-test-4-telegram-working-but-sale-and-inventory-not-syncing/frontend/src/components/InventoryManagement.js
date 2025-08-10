import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { Package, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Search, Filter, Download, Upload, BarChart, Database } from 'lucide-react';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';
import TallyImport from './TallyImport';

const InventoryManagement = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Tally Import State
  const [showTallyImport, setShowTallyImport] = useState(false);
  
  // Notification Settings State
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  
  // Add/Edit Medicine Dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [medicineForm, setMedicineForm] = useState({
    name: '',
    price: '',
    stock_quantity: '',
    expiry_date: '',
    batch_number: '',
    supplier: '',
    barcode: '',
    min_stock_level: '',
    description: '',
    category: '',
    // Telegram Notification Settings
    low_stock_threshold: '',
    expiry_alert_days: '',
    notifications_enabled: true
  });

  const { 
    user, 
    getMedicines, 
    addMedicine, 
    updateMedicine, 
    deleteMedicine 
  } = useOfflineAuth();

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const medicineList = await getMedicines();
      // Ensure medicineList is always an array
      setMedicines(Array.isArray(medicineList) ? medicineList : []);
    } catch (error) {
      console.error('Error loading medicines:', error);
      setMedicines([]); // Set to empty array on error
      showMessage('Error loading medicines', 'error');
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

  const resetForm = () => {
    setMedicineForm({
      name: '',
      price: '',
      stock_quantity: '',
      expiry_date: '',
      batch_number: '',
      supplier: '',
      barcode: '',
      min_stock_level: '',
      description: '',
      category: '',
      // Reset notification settings
      low_stock_threshold: '',
      expiry_alert_days: '',
      notifications_enabled: true
    });
  };

  // Fetch notification settings for a medicine
  const fetchNotificationSettings = async (medicineId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/medicines/${medicineId}/notification-settings`);
      if (response.ok) {
        const settings = await response.json();
        return settings;
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
    return {
      low_stock_threshold: 10,
      expiry_alert_days: 30,
      enabled: true
    };
  };

  // Update notification settings for a medicine
  const updateNotificationSettings = async (medicineId, settings) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/medicines/${medicineId}/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          medicine_id: medicineId,
          low_stock_threshold: settings.low_stock_threshold,
          expiry_alert_days: settings.expiry_alert_days,
          enabled: settings.enabled
        }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
    return null;
  };

  // Open notification settings dialog
  const openNotificationDialog = async (medicine) => {
    setSelectedMedicine(medicine);
    setNotificationLoading(true);
    
    const settings = await fetchNotificationSettings(medicine.id);
    setMedicineForm({
      ...medicineForm,
      low_stock_threshold: settings.low_stock_threshold.toString(),
      expiry_alert_days: settings.expiry_alert_days.toString(),
      notifications_enabled: settings.enabled
    });
    
    setNotificationLoading(false);
    setShowNotificationDialog(true);
  };

  // Handle notification settings update
  const handleUpdateNotificationSettings = async (e) => {
    e.preventDefault();
    setNotificationLoading(true);

    try {
      const settings = {
        low_stock_threshold: parseInt(medicineForm.low_stock_threshold),
        expiry_alert_days: parseInt(medicineForm.expiry_alert_days),
        enabled: medicineForm.notifications_enabled
      };

      const result = await updateNotificationSettings(selectedMedicine.id, settings);
      
      if (result) {
        showMessage('Notification settings updated successfully', 'success');
        setShowNotificationDialog(false);
      } else {
        showMessage('Error updating notification settings', 'error');
      }
    } catch (error) {
      showMessage('Error updating notification settings', 'error');
    }
    
    setNotificationLoading(false);
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const medicineData = {
        name: medicineForm.name,
        price: parseFloat(medicineForm.price),
        stock_quantity: parseInt(medicineForm.stock_quantity),
        expiry_date: medicineForm.expiry_date,
        batch_number: medicineForm.batch_number,
        supplier: medicineForm.supplier,
        barcode: medicineForm.barcode || undefined,
        min_stock_level: parseInt(medicineForm.min_stock_level) || 10,
        description: medicineForm.description,
        category: medicineForm.category
      };

      const newMedicine = addMedicine(medicineData);
      
      if (newMedicine) {
        // Set up notification settings for new medicine
        const notificationSettings = {
          low_stock_threshold: parseInt(medicineForm.low_stock_threshold) || 10,
          expiry_alert_days: parseInt(medicineForm.expiry_alert_days) || 30,
          enabled: medicineForm.notifications_enabled
        };
        
        await updateNotificationSettings(newMedicine.id, notificationSettings);
        
        showMessage('Medicine added successfully with notification settings', 'success');
        setShowAddDialog(false);
        resetForm();
        await loadMedicines();
      } else {
        showMessage('Error adding medicine', 'error');
      }
    } catch (error) {
      showMessage('Error adding medicine', 'error');
    }
    
    setLoading(false);
  };

  const handleEditMedicine = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const medicineData = {
        name: medicineForm.name,
        price: parseFloat(medicineForm.price),
        stock_quantity: parseInt(medicineForm.stock_quantity),
        expiry_date: medicineForm.expiry_date,
        batch_number: medicineForm.batch_number,
        supplier: medicineForm.supplier,
        barcode: medicineForm.barcode || undefined,
        min_stock_level: parseInt(medicineForm.min_stock_level) || 10,
        description: medicineForm.description,
        category: medicineForm.category
      };

      const updatedMedicine = updateMedicine(selectedMedicine.id, medicineData);
      
      if (updatedMedicine) {
        // Also update notification settings
        const notificationSettings = {
          low_stock_threshold: parseInt(medicineForm.low_stock_threshold) || 10,
          expiry_alert_days: parseInt(medicineForm.expiry_alert_days) || 30,
          enabled: medicineForm.notifications_enabled
        };
        
        await updateNotificationSettings(selectedMedicine.id, notificationSettings);
        
        showMessage('Medicine and notification settings updated successfully', 'success');
        setShowEditDialog(false);
        setSelectedMedicine(null);
        resetForm();
        await loadMedicines();
      } else {
        showMessage('Error updating medicine', 'error');
      }
    } catch (error) {
      showMessage('Error updating medicine', 'error');
    }
    
    setLoading(false);
  };

  const handleDeleteMedicine = async (medicineId, medicineName) => {
    if (!window.confirm(`Are you sure you want to delete ${medicineName}?`)) return;

    try {
      const success = deleteMedicine(medicineId);
      
      if (success) {
        await loadMedicines();
        showMessage('Medicine deleted successfully', 'success');
      } else {
        showMessage('Error deleting medicine', 'error');
      }
    } catch (error) {
      showMessage('Error deleting medicine', 'error');
    }
  };

  const handleTallyImportComplete = async (importResults) => {
    // Refresh medicines after import
    await loadMedicines();
    
    // Show success message
    showMessage(`Import completed! ${importResults.imported} medicines imported successfully.`, 'success');
    
    // Close import dialog
    setShowTallyImport(false);
  };

  const openEditDialog = async (medicine) => {
    setSelectedMedicine(medicine);
    
    // Fetch notification settings
    const notificationSettings = await fetchNotificationSettings(medicine.id);
    
    setMedicineForm({
      name: medicine.name,
      price: medicine.price.toString(),
      stock_quantity: medicine.stock_quantity.toString(),
      expiry_date: medicine.expiry_date,
      batch_number: medicine.batch_number,
      supplier: medicine.supplier,
      barcode: medicine.barcode || '',
      min_stock_level: (medicine.min_stock_level || 10).toString(),
      description: medicine.description || '',
      category: medicine.category || '',
      // Include notification settings
      low_stock_threshold: notificationSettings.low_stock_threshold.toString(),
      expiry_alert_days: notificationSettings.expiry_alert_days.toString(),
      notifications_enabled: notificationSettings.enabled
    });
    setShowEditDialog(true);
  };

  // Filter medicines based on search and status
  const filteredMedicines = (Array.isArray(medicines) ? medicines : []).filter(medicine => {
    const matchesSearch = medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         medicine.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         medicine.batch_number.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'low-stock') return matchesSearch && medicine.stock_quantity <= (medicine.min_stock_level || 10);
    if (filterStatus === 'out-of-stock') return matchesSearch && medicine.stock_quantity === 0;
    if (filterStatus === 'expired') {
      const expiryDate = new Date(medicine.expiry_date);
      const today = new Date();
      return matchesSearch && expiryDate < today;
    }
    if (filterStatus === 'expiring-soon') {
      const expiryDate = new Date(medicine.expiry_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return matchesSearch && expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
    }
    
    return matchesSearch;
  });

  // Calculate inventory statistics
  const stats = {
    total: (Array.isArray(medicines) ? medicines : []).length,
    lowStock: (Array.isArray(medicines) ? medicines : []).filter(m => m.stock_quantity <= (m.min_stock_level || 10)).length,
    outOfStock: (Array.isArray(medicines) ? medicines : []).filter(m => m.stock_quantity === 0).length,
    totalValue: (Array.isArray(medicines) ? medicines : []).reduce((sum, m) => sum + (m.price * m.stock_quantity), 0)
  };

  const getStockStatus = (medicine) => {
    if (medicine.stock_quantity === 0) return { status: 'out-of-stock', color: 'bg-red-100 text-red-800', text: 'Out of Stock' };
    if (medicine.stock_quantity <= (medicine.min_stock_level || 10)) return { status: 'low-stock', color: 'bg-yellow-100 text-yellow-800', text: 'Low Stock' };
    return { status: 'in-stock', color: 'bg-green-100 text-green-800', text: 'In Stock' };
  };

  const getExpiryStatus = (expiryDate) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(today.getDate() + 30);

    if (expiry < today) return { color: 'text-red-600', text: 'Expired', urgent: true };
    if (expiry <= thirtyDays) return { color: 'text-orange-600', text: 'Expiring Soon', urgent: true };
    return { color: 'text-green-600', text: 'Good', urgent: false };
  };

  if (!user || !['admin', 'manager'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Package className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-slate-600 text-center">You don't have permission to access inventory management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
              <p className="text-slate-600">Manage your medicine inventory and stock levels</p>
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Items</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Low Stock</p>
                  <p className="text-3xl font-bold text-yellow-900">{stats.lowStock}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Out of Stock</p>
                  <p className="text-3xl font-bold text-red-900">{stats.outOfStock}</p>
                </div>
                <Package className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Total Value</p>
                  <p className="text-3xl font-bold text-green-900">₹{stats.totalValue.toLocaleString()}</p>
                </div>
                <BarChart className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Search medicines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <SelectValue placeholder="Filter by status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="low-stock">Low Stock</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="expiring-soon">Expiring Soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {user?.role === 'admin' && (
                  <Button
                    onClick={() => setShowTallyImport(true)}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Import Tally Data
                  </Button>
                )}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Medicine
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add New Medicine</DialogTitle>
                      <DialogDescription>
                        Add a new medicine to your inventory
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleAddMedicine} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Medicine Name *</Label>
                          <Input
                            value={medicineForm.name}
                            onChange={(e) => setMedicineForm({...medicineForm, name: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Input
                            value={medicineForm.category}
                            onChange={(e) => setMedicineForm({...medicineForm, category: e.target.value})}
                            placeholder="e.g., Antibiotics, Pain Relief"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price (₹) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={medicineForm.price}
                            onChange={(e) => setMedicineForm({...medicineForm, price: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stock Quantity *</Label>
                          <Input
                            type="number"
                            value={medicineForm.stock_quantity}
                            onChange={(e) => setMedicineForm({...medicineForm, stock_quantity: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Minimum Stock Level</Label>
                          <Input
                            type="number"
                            value={medicineForm.min_stock_level}
                            onChange={(e) => setMedicineForm({...medicineForm, min_stock_level: e.target.value})}
                            placeholder="10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiry Date *</Label>
                          <Input
                            type="date"
                            value={medicineForm.expiry_date}
                            onChange={(e) => setMedicineForm({...medicineForm, expiry_date: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Batch Number *</Label>
                          <Input
                            value={medicineForm.batch_number}
                            onChange={(e) => setMedicineForm({...medicineForm, batch_number: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Supplier *</Label>
                          <Input
                            value={medicineForm.supplier}
                            onChange={(e) => setMedicineForm({...medicineForm, supplier: e.target.value})}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Barcode</Label>
                        <Input
                          value={medicineForm.barcode}
                          onChange={(e) => setMedicineForm({...medicineForm, barcode: e.target.value})}
                          placeholder="Optional"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={medicineForm.description}
                          onChange={(e) => setMedicineForm({...medicineForm, description: e.target.value})}
                          placeholder="Medicine description, usage instructions, etc."
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddDialog(false);
                            resetForm();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                          {loading ? 'Adding...' : 'Add Medicine'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medicines Table */}
        <Card>
          <CardHeader>
            <CardTitle>Medicine Inventory ({filteredMedicines.length} items)</CardTitle>
            <CardDescription>Manage your medicine stock and inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Medicine</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Category</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Price</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Expiry</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Supplier</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map((medicine) => {
                    const stockStatus = getStockStatus(medicine);
                    const expiryStatus = getExpiryStatus(medicine.expiry_date);
                    
                    return (
                      <tr key={medicine.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-slate-900">{medicine.name}</div>
                            <div className="text-sm text-slate-500">Batch: {medicine.batch_number}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600">{medicine.category || 'Uncategorized'}</span>
                        </td>
                        <td className="text-right py-3 px-4 font-semibold text-green-600">
                          ₹{medicine.price.toFixed(2)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="font-semibold text-slate-900">{medicine.stock_quantity}</div>
                          <div className="text-xs text-slate-500">Min: {medicine.min_stock_level || 10}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={stockStatus.color}>
                            {stockStatus.text}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`text-sm ${expiryStatus.color} ${expiryStatus.urgent ? 'font-semibold' : ''}`}>
                            {new Date(medicine.expiry_date).toLocaleDateString()}
                          </div>
                          <div className={`text-xs ${expiryStatus.color}`}>
                            {expiryStatus.text}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {medicine.supplier}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(medicine)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteMedicine(medicine.id, medicine.name)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredMedicines.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No medicines found matching your criteria' 
                    : 'No medicines in inventory. Add some medicines to get started!'
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Medicine Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Medicine</DialogTitle>
              <DialogDescription>
                Update medicine information
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEditMedicine} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medicine Name *</Label>
                  <Input
                    value={medicineForm.name}
                    onChange={(e) => setMedicineForm({...medicineForm, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={medicineForm.category}
                    onChange={(e) => setMedicineForm({...medicineForm, category: e.target.value})}
                    placeholder="e.g., Antibiotics, Pain Relief"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={medicineForm.price}
                    onChange={(e) => setMedicineForm({...medicineForm, price: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock Quantity *</Label>
                  <Input
                    type="number"
                    value={medicineForm.stock_quantity}
                    onChange={(e) => setMedicineForm({...medicineForm, stock_quantity: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Stock Level</Label>
                  <Input
                    type="number"
                    value={medicineForm.min_stock_level}
                    onChange={(e) => setMedicineForm({...medicineForm, min_stock_level: e.target.value})}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date *</Label>
                  <Input
                    type="date"
                    value={medicineForm.expiry_date}
                    onChange={(e) => setMedicineForm({...medicineForm, expiry_date: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batch Number *</Label>
                  <Input
                    value={medicineForm.batch_number}
                    onChange={(e) => setMedicineForm({...medicineForm, batch_number: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Input
                    value={medicineForm.supplier}
                    onChange={(e) => setMedicineForm({...medicineForm, supplier: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input
                  value={medicineForm.barcode}
                  onChange={(e) => setMedicineForm({...medicineForm, barcode: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={medicineForm.description}
                  onChange={(e) => setMedicineForm({...medicineForm, description: e.target.value})}
                  placeholder="Medicine description, usage instructions, etc."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedMedicine(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Medicine'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Tally Import Dialog */}
        {showTallyImport && (
          <TallyImport
            onClose={() => setShowTallyImport(false)}
            onImportComplete={handleTallyImportComplete}
          />
        )}
      </div>
    </div>
  );
};

export default InventoryManagement;