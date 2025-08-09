import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter } from "react-router-dom";
import './App.css';
import { OfflineAuthProvider, useOfflineAuth } from './contexts/OfflineAuthContext';
import ModernLogin from './components/ModernLogin';
import OfflineUserManagement from './components/OfflineUserManagement';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import InventoryManagement from './components/InventoryManagement';
import SalesManagement from './components/SalesManagement';
import ShopSettings from './components/ShopSettings';
import TallyImport from './components/TallyImport';
import { Toaster } from './components/ui/toaster';

// Main RMS App Component
const RMSApp = () => {
  const [currentView, setCurrentView] = useState('pos');

  // Backup and Restore states
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [backupOptions, setBackupOptions] = useState({
    include_medicines: true,
    include_sales: true,
    include_stock_movements: true,
    include_shop_details: true,
    include_import_logs: true,
    include_status_checks: false,
    backup_name: ''
  });
  const [restoreOptions, setRestoreOptions] = useState({
    backup_id: '',
    include_medicines: true,
    include_sales: true,
    include_stock_movements: true,
    include_shop_details: true,
    include_import_logs: true,
    include_status_checks: false,
    clear_existing_data: false
  });
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupPreview, setBackupPreview] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [shop, setShop] = useState(null);
  const [selectedMedicineIndex, setSelectedMedicineIndex] = useState(0);
  const [quickQuantity, setQuickQuantity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isQuickEntry, setIsQuickEntry] = useState(false);
  
  // NEW: Discount and Return State
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percentage', 'fixed'
  const [discountValue, setDiscountValue] = useState(0);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  
  // Loading and Authentication State
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Medicine Management State
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showEditMedicine, setShowEditMedicine] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [medicineForm, setMedicineForm] = useState({
    name: '',
    price: '',
    stock_quantity: '',
    expiry_date: '',
    batch_number: '',
    supplier: '',
    barcode: ''
  });
  const [medicineLoading, setMedicineLoading] = useState(false);
  const [medicineMessage, setMedicineMessage] = useState('');
  
  // Sales Management State
  const [showEditSale, setShowEditSale] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleForm, setSaleForm] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    items: [],
    total_amount: 0
  });
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleMessage, setSaleMessage] = useState('');
  const [showSaleDetails, setShowSaleDetails] = useState(false);

  // Shop Management State
  const [showEditShop, setShowEditShop] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    license_number: '',
    gst_number: ''
  });
  const [shopLoading, setShopLoading] = useState(false);
  const [shopMessage, setShopMessage] = useState('');

  // Tally Import State
  const [showTallyImport, setShowTallyImport] = useState(false);
  const [tallyImporting, setTallyImporting] = useState(false);
  const [tallyMessage, setTallyMessage] = useState('');
  
  const { 
    user, 
    logout, 
    getMedicines, 
    addMedicine, 
    updateMedicine, 
    deleteMedicine,
    getSales,
    addSale,
    getSaleById,
    updateSale,
    deleteSale,
    getSalesAnalytics,
    getShop,
    updateShop,
    addReturn // NEW: Return functionality
  } = useOfflineAuth();
  
  // Refs for keyboard navigation
  const searchRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const returnSearchRef = useRef(null);

  // Check user permissions
  const canAccessView = (view) => {
    const userRole = user?.role;
    switch (view) {
      case 'users':
      case 'shop': // Shop settings is admin only
        return userRole === 'admin';
      case 'inventory':
      case 'analytics': // Analytics access for admin and manager
      case 'backup': // Add backup access to admin and manager
        return ['admin', 'manager'].includes(userRole);
      case 'pos':
      case 'sales':
        return ['admin', 'manager', 'cashier'].includes(userRole);
      default:
        return true;
    }
  };

  const canModifyInventory = () => {
    return ['admin', 'manager'].includes(user?.role);
  };

  const canEditSales = () => {
    return ['admin', 'manager'].includes(user?.role);
  };

  const canImportTally = () => {
    return ['admin'].includes(user?.role);
  };

  const handleTallyImportComplete = (importResults) => {
    // Refresh medicines after import
    fetchMedicines();
    
    // Show success message
    setTallyMessage(`Import completed! ${importResults.imported} medicines imported successfully.`);
    setTimeout(() => setTallyMessage(''), 5000);
    
    // Close import dialog
    setShowTallyImport(false);
  };

  // Initialize authentication state
  useEffect(() => {
    // Simulate loading time and check authentication
    const initializeAuth = () => {
      setLoading(true);
      // Check if user is authenticated
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    initializeAuth();
  }, [user]);

  // Fetch data on component mount
  useEffect(() => {
    if (user) {
      fetchMedicines();
      fetchSales();
      fetchAnalytics();
      fetchShop();
    }
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Handle Enter key in search
        if (e.key === 'Enter' && e.target === searchRef.current) {
          e.preventDefault();
          if (medicines.length > 0) {
            if (isReturnMode) {
              addToReturnCart(medicines[selectedMedicineIndex]);
            } else {
              addToCart(medicines[selectedMedicineIndex]);
            }
          }
        }
        // Handle Escape to blur input
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // Global shortcuts
      switch (e.key) {
        // Navigation shortcuts
        case 'p':
        case 'P':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            if (canAccessView('pos')) {
              setCurrentView('pos');
            }
          }
          break;
        case 'i':
        case 'I':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            if (canAccessView('inventory')) {
              setCurrentView('inventory');
            }
          }
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            if (canAccessView('sales')) {
              setCurrentView('sales');
            }
          }
          break;
        case 'a':
        case 'A':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            if (canAccessView('analytics')) {
              setCurrentView('analytics');
            }
          }
          break;
        case 'u':
        case 'U':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            if (canAccessView('users')) {
              setCurrentView('users');
            }
          }
          break;

        // POS specific shortcuts
        case 'F1':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case 'F2':
          if (cart.length > 0) {
            e.preventDefault();
            handleCheckout();
          }
          break;
        case 'F3':
          e.preventDefault();
          setCart([]);
          setDiscountType('none');
          setDiscountValue(0);
          break;
        case 'F4':
          e.preventDefault();
          customerNameRef.current?.focus();
          break;
        case 'F5':
          e.preventDefault();
          setPaymentMethod(paymentMethod === 'cash' ? 'card' : paymentMethod === 'card' ? 'upi' : 'cash');
          break;
        case 'F6': // NEW: Toggle return mode
          e.preventDefault();
          toggleReturnMode();
          break;

        // Quick navigation in medicine list
        case 'ArrowDown':
          if (currentView === 'pos' && medicines.length > 0) {
            e.preventDefault();
            setSelectedMedicineIndex(prev => (prev + 1) % medicines.length);
          }
          break;
        case 'ArrowUp':
          if (currentView === 'pos' && medicines.length > 0) {
            e.preventDefault();
            setSelectedMedicineIndex(prev => prev === 0 ? medicines.length - 1 : prev - 1);
          }
          break;
        case 'Enter':
          if (currentView === 'pos' && medicines.length > 0) {
            e.preventDefault();
            if (isReturnMode) {
              addToReturnCart(medicines[selectedMedicineIndex]);
            } else {
              addToCart(medicines[selectedMedicineIndex]);
            }
          }
          break;

        // Quick quantity shortcuts
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (currentView === 'pos' && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            setQuickQuantity(prev => prev + e.key);
            setIsQuickEntry(true);
            setTimeout(() => setIsQuickEntry(false), 2000);
          }
          break;

        case '+':
        case '=':
          if (currentView === 'pos' && quickQuantity && medicines.length > 0) {
            e.preventDefault();
            const qty = parseInt(quickQuantity) || 1;
            const medicine = medicines[selectedMedicineIndex];
            if (isReturnMode) {
              addMultipleToReturnCart(medicine, qty);
            } else {
              addMultipleToCart(medicine, qty);
            }
            setQuickQuantity('');
            setIsQuickEntry(false);
          }
          break;

        // Clear shortcuts
        case 'Escape':
          setQuickQuantity('');
          setIsQuickEntry(false);
          break;
        case 'Backspace':
          if (currentView === 'pos' && quickQuantity) {
            e.preventDefault();
            setQuickQuantity(prev => prev.slice(0, -1));
          }
          break;

        // Quick search focus
        case '/':
          e.preventDefault();
          if (isReturnMode) {
            returnSearchRef.current?.focus();
          } else {
            searchRef.current?.focus();
            searchRef.current?.select();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart, medicines, selectedMedicineIndex, quickQuantity, currentView, paymentMethod, user, isReturnMode]);

  // NEW: Toggle Return Mode
  const toggleReturnMode = () => {
    setIsReturnMode(!isReturnMode);
    setCart([]);
    setDiscountType('none');
    setDiscountValue(0);
    setSearchTerm('');
    setReturnSearchTerm('');
  };

  // NEW: Calculate discount amount
  const calculateDiscount = (subtotal) => {
    if (discountType === 'percentage') {
      return (subtotal * discountValue) / 100;
    } else if (discountType === 'fixed') {
      return Math.min(discountValue, subtotal); // Can't discount more than subtotal
    }
    return 0;
  };

  // Backup and Restore API functions
  const createBackup = async (options) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Create backup error:', error);
      return null;
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/list`);
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      
      const data = await response.json();
      setBackups(data.backups);
      return data.backups;
    } catch (error) {
      console.error('Fetch backups error:', error);
      return [];
    }
  };

  const fetchBackupPreview = async (backupId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/preview/${backupId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch backup preview');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Fetch backup preview error:', error);
      return null;
    }
  };

  const restoreBackup = async (options) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Restore backup error:', error);
      return null;
    }
  };

  const deleteBackup = async (backupId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/${backupId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete backup');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Delete backup error:', error);
      return null;
    }
  };

  const downloadBackup = async (backupId, backupName) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/download/${backupId}`);
      if (!response.ok) {
        throw new Error('Failed to download backup');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${backupName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Download backup error:', error);
      return false;
    }
  };

  const uploadBackupFile = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/backup/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload backup file');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Upload backup error:', error);
      return null;
    }
  };

  // Data fetching functions using offline storage
  const fetchMedicines = (search = '') => {
    try {
      const medicineList = getMedicines(search);
      setMedicines(medicineList);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchSales = () => {
    try {
      const salesList = getSales();
      setSales(salesList);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const fetchAnalytics = () => {
    try {
      const analyticsData = getSalesAnalytics();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchShop = async () => {
    try {
      const shopData = await getShop();
      setShop(shopData);
    } catch (error) {
      console.error('Error fetching shop details:', error);
    }
  };

  const addMultipleToCart = (medicine, quantity = 1) => {
    if (medicine.stock_quantity < quantity) {
      alert(`Insufficient stock! Only ${medicine.stock_quantity} units available.`);
      return;
    }

    const existingItem = cart.find(item => item.medicine_id === medicine.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= medicine.stock_quantity) {
        setCart(cart.map(item =>
          item.medicine_id === medicine.id
            ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
            : item
        ));
      } else {
        alert(`Cannot add ${quantity} more. Stock limit: ${medicine.stock_quantity}, Current in cart: ${existingItem.quantity}`);
      }
    } else {
      setCart([...cart, {
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        quantity: quantity,
        price: medicine.price,
        total: medicine.price * quantity,
        is_return: false
      }]);
    }
  };

  // NEW: Add to return cart (returns don't need stock validation)
  const addMultipleToReturnCart = (medicine, quantity = 1) => {
    const existingItem = cart.find(item => item.medicine_id === medicine.id && item.is_return);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      setCart(cart.map(item =>
        item.medicine_id === medicine.id && item.is_return
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        quantity: quantity,
        price: medicine.price,
        total: medicine.price * quantity,
        is_return: true
      }]);
    }
  };

  const addToReturnCart = (medicine, quantity = 1) => {
    addMultipleToReturnCart(medicine, quantity);
  };

  // POS functions
  const addToCart = (medicine, quantity = 1) => {
    addMultipleToCart(medicine, quantity);
  };

  const updateCartQuantity = (medicineId, newQuantity, isReturn = false) => {
    if (newQuantity === 0) {
      setCart(cart.filter(item => !(item.medicine_id === medicineId && item.is_return === isReturn)));
    } else {
      setCart(cart.map(item =>
        item.medicine_id === medicineId && item.is_return === isReturn
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    }
  };

  const getCartSubtotal = () => {
    return cart.reduce((total, item) => {
      return item.is_return ? total - item.total : total + item.total;
    }, 0);
  };

  const getCartTotal = () => {
    const subtotal = getCartSubtotal();
    const discount = calculateDiscount(Math.abs(subtotal));
    return subtotal - discount;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const subtotal = getCartSubtotal();
      const discountAmount = calculateDiscount(Math.abs(subtotal));
      const total = subtotal - discountAmount;

      const saleData = {
        items: cart,
        total_amount: total,
        subtotal_amount: subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        cashier_id: user.id,
        is_return: isReturnMode || cart.some(item => item.is_return)
      };

      const newSale = addSale(saleData);
      
      if (newSale) {
        // Clear cart and reset form
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setPaymentMethod('cash');
        setDiscountType('none');
        setDiscountValue(0);
        setIsReturnMode(false);
        fetchMedicines();
        fetchSales();
        fetchAnalytics();
        
        const message = isReturnMode ? 'Return processed successfully!' : 'Sale completed successfully!';
        alert(message);
        
        // Focus back to search for next transaction
        setTimeout(() => {
          searchRef.current?.focus();
        }, 100);
      } else {
        alert('Error processing transaction. Please try again.');
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Error processing transaction. Please try again.');
    }
  };

  // Search handler
  const handleSearch = (term) => {
    setSearchTerm(term);
    fetchMedicines(term);
  };

  // NEW: Return search handler
  const handleReturnSearch = (term) => {
    setReturnSearchTerm(term);
    fetchMedicines(term); // Search in same medicines database
  };

  // Medicine management functions (existing code continues...)
  const resetMedicineForm = () => {
    setMedicineForm({
      name: '',
      price: '',
      stock_quantity: '',
      expiry_date: '',
      batch_number: '',
      supplier: '',
      barcode: ''
    });
  };

  const handleAddMedicine = async (e) => {
    e.preventDefault();
    setMedicineLoading(true);
    setMedicineMessage('');

    try {
      const medicineData = {
        name: medicineForm.name,
        price: parseFloat(medicineForm.price),
        stock_quantity: parseInt(medicineForm.stock_quantity),
        expiry_date: medicineForm.expiry_date,
        batch_number: medicineForm.batch_number,
        supplier: medicineForm.supplier,
        barcode: medicineForm.barcode || undefined
      };

      const newMedicine = addMedicine(medicineData);
      
      if (newMedicine) {
        setShowAddMedicine(false);
        resetMedicineForm();
        fetchMedicines();
        setMedicineMessage('Medicine added successfully');
        setTimeout(() => setMedicineMessage(''), 3000);
      } else {
        setMedicineMessage('Error adding medicine');
      }
    } catch (error) {
      setMedicineMessage('Error adding medicine');
    }
    
    setMedicineLoading(false);
  };

  const openEditMedicine = (medicine) => {
    setSelectedMedicine(medicine);
    setMedicineForm({
      name: medicine.name,
      price: medicine.price.toString(),
      stock_quantity: medicine.stock_quantity.toString(),
      expiry_date: medicine.expiry_date,
      batch_number: medicine.batch_number,
      supplier: medicine.supplier,
      barcode: medicine.barcode || ''
    });
    setShowEditMedicine(true);
  };

  const handleEditMedicine = async (e) => {
    e.preventDefault();
    setMedicineLoading(true);
    setMedicineMessage('');

    try {
      const medicineData = {
        name: medicineForm.name,
        price: parseFloat(medicineForm.price),
        stock_quantity: parseInt(medicineForm.stock_quantity),
        expiry_date: medicineForm.expiry_date,
        batch_number: medicineForm.batch_number,
        supplier: medicineForm.supplier,
        barcode: medicineForm.barcode || undefined
      };

      const updatedMedicine = updateMedicine(selectedMedicine.id, medicineData);
      
      if (updatedMedicine) {
        setShowEditMedicine(false);
        setSelectedMedicine(null);
        resetMedicineForm();
        fetchMedicines();
        setMedicineMessage('Medicine updated successfully');
        setTimeout(() => setMedicineMessage(''), 3000);
      } else {
        setMedicineMessage('Error updating medicine');
      }
    } catch (error) {
      setMedicineMessage('Error updating medicine');
    }
    
    setMedicineLoading(false);
  };

  // Sales editing functions (existing code)
  const resetSaleForm = () => {
    setSaleForm({
      customer_name: '',
      customer_phone: '',
      payment_method: 'cash',
      items: [],
      total_amount: 0
    });
  };

  const openSaleDetails = (sale) => {
    setSelectedSale(sale);
    setShowSaleDetails(true);
  };

  const openEditSale = (sale) => {
    setSelectedSale(sale);
    setSaleForm({
      customer_name: sale.customer_name || '',
      customer_phone: sale.customer_phone || '',
      payment_method: sale.payment_method || 'cash',
      items: [...sale.items],
      total_amount: sale.total_amount
    });
    setShowEditSale(true);
  };

  const handleEditSale = async (e) => {
    e.preventDefault();
    setSaleLoading(true);
    setSaleMessage('');

    try {
      const updatedSaleData = {
        customer_name: saleForm.customer_name || undefined,
        customer_phone: saleForm.customer_phone || undefined,
        payment_method: saleForm.payment_method,
        items: saleForm.items,
        total_amount: saleForm.total_amount
      };

      const updatedSale = updateSale(selectedSale.id, updatedSaleData);
      
      if (updatedSale) {
        setShowEditSale(false);
        setSelectedSale(null);
        resetSaleForm();
        fetchSales();
        fetchAnalytics();
        fetchMedicines();
        setSaleMessage('Sale updated successfully');
        setTimeout(() => setSaleMessage(''), 3000);
      } else {
        setSaleMessage('Error updating sale');
      }
    } catch (error) {
      setSaleMessage('Error updating sale');
    }
    
    setSaleLoading(false);
  };

  const handleDeleteSale = async (saleId, receiptNumber) => {
    if (!window.confirm(`Are you sure you want to delete sale ${receiptNumber}?`)) return;

    try {
      const success = deleteSale(saleId);
      
      if (success) {
        fetchSales();
        fetchAnalytics();
        fetchMedicines();
        setSaleMessage('Sale deleted successfully');
        setTimeout(() => setSaleMessage(''), 3000);
      } else {
        setSaleMessage('Error deleting sale');
      }
    } catch (error) {
      setSaleMessage('Error deleting sale');
    }
  };

  const updateSaleItemQuantity = (itemIndex, newQuantity) => {
    if (newQuantity <= 0) {
      const updatedItems = saleForm.items.filter((_, index) => index !== itemIndex);
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      setSaleForm({
        ...saleForm,
        items: updatedItems,
        total_amount: newTotal
      });
    } else {
      const updatedItems = saleForm.items.map((item, index) => {
        if (index === itemIndex) {
          const newTotal = item.price * newQuantity;
          return { ...item, quantity: newQuantity, total: newTotal };
        }
        return item;
      });
      const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      setSaleForm({
        ...saleForm,
        items: updatedItems,
        total_amount: newTotal
      });
    }
  };

  const removeSaleItem = (itemIndex) => {
    const updatedItems = saleForm.items.filter((_, index) => index !== itemIndex);
    const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    setSaleForm({
      ...saleForm,
      items: updatedItems,
      total_amount: newTotal
    });
  };

  const handleDeleteMedicine = async (medicineId, medicineName) => {
    if (!window.confirm(`Are you sure you want to delete ${medicineName}?`)) return;

    try {
      const success = deleteMedicine(medicineId);
      
      if (success) {
        fetchMedicines();
        setMedicineMessage('Medicine deleted successfully');
        setTimeout(() => setMedicineMessage(''), 3000);
      } else {
        setMedicineMessage('Error deleting medicine');
      }
    } catch (error) {
      setMedicineMessage('Error deleting medicine');
    }
  };

  // Shop management functions (existing code)
  const resetShopForm = () => {
    setShopForm({
      name: '',
      address: '',
      phone: '',
      email: '',
      license_number: '',
      gst_number: ''
    });
  };

  const openEditShop = () => {
    if (shop) {
      setShopForm({
        name: shop.name || '',
        address: shop.address || '',
        phone: shop.phone || '',
        email: shop.email || '',
        license_number: shop.license_number || '',
        gst_number: shop.gst_number || ''
      });
    } else {
      resetShopForm();
    }
    setShowEditShop(true);
  };

  const handleEditShop = async (e) => {
    e.preventDefault();
    setShopLoading(true);
    setShopMessage('');

    try {
      const updatedShop = await updateShop(shopForm);
      
      if (updatedShop) {
        setShowEditShop(false);
        resetShopForm();
        await fetchShop(); // Wait for fetch to complete
        setShopMessage('Shop details updated successfully');
        setTimeout(() => setShopMessage(''), 3000);
      } else {
        setShopMessage('Error updating shop details');
      }
    } catch (error) {
      setShopMessage('Error updating shop details');
    }
    
    setShopLoading(false);
  };

  // Navigation component
  const Navigation = () => (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MP</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MediPOS RMS</h1>
              <p className="text-sm text-slate-400">Welcome, {user?.full_name || user?.username} ({user?.role})</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canAccessView('pos') && (
            <button
              onClick={() => setCurrentView('pos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'pos' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              POS <span className="text-xs opacity-75">(Ctrl+P)</span>
            </button>
          )}
          {canAccessView('inventory') && (
            <button
              onClick={() => setCurrentView('inventory')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'inventory' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Inventory <span className="text-xs opacity-75">(Ctrl+I)</span>
            </button>
          )}
          {canAccessView('sales') && (
            <button
              onClick={() => setCurrentView('sales')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'sales' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Sales <span className="text-xs opacity-75">(Ctrl+S)</span>
            </button>
          )}
          {canAccessView('analytics') && (
            <button
              onClick={() => setCurrentView('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'analytics' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Analytics <span className="text-xs opacity-75">(Ctrl+A)</span>
            </button>
          )}
          {canAccessView('users') && (
            <button
              onClick={() => setCurrentView('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'users' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Users <span className="text-xs opacity-75">(Ctrl+U)</span>
            </button>
          )}
          {canAccessView('shop') && (
            <button
              onClick={() => setCurrentView('shop')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'shop' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Shop Settings
            </button>
          )}
          {canAccessView('backup') && (
            <button
              onClick={() => setCurrentView('backup')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentView === 'backup' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              🗄️ Backup & Restore
            </button>
          )}
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );

  // Enhanced POS View with Return and Discount functionality
  const POSView = () => (
    <div className="flex h-screen bg-slate-100">
      {/* Product Search & Selection */}
      <div className="w-2/3 p-6">
        {/* Mode Toggle and Search */}
        <div className="mb-4 flex gap-4 items-center">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-300">
            <button
              onClick={() => setIsReturnMode(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !isReturnMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              🛒 Sale Mode
            </button>
            <button
              onClick={() => setIsReturnMode(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isReturnMode ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              ↩️ Return Mode
            </button>
          </div>
          <kbd className="bg-slate-200 px-2 py-1 rounded text-xs">F6 to toggle</kbd>
        </div>

        <div className="mb-4 relative">
          <input
            ref={isReturnMode ? returnSearchRef : searchRef}
            type="text"
            placeholder={isReturnMode ? "Search medicines to return... (Press F1 to focus, / for quick focus)" : "Search medicines... (Press F1 to focus, / for quick focus, Enter to add selected)"}
            className={`w-full p-3 border rounded-lg text-lg focus:ring-2 focus:border-transparent ${
              isReturnMode 
                ? 'border-orange-300 focus:ring-orange-500 bg-orange-50' 
                : 'border-slate-300 focus:ring-blue-500'
            }`}
            value={isReturnMode ? returnSearchTerm : searchTerm}
            onChange={(e) => isReturnMode ? handleReturnSearch(e.target.value) : handleSearch(e.target.value)}
          />
          {isQuickEntry && (
            <div className="absolute top-full left-0 mt-1 bg-yellow-100 border border-yellow-300 px-3 py-1 rounded text-sm">
              Quick Quantity: {quickQuantity} (Press + to add, Backspace to edit)
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {medicines.map((medicine, index) => (
            <div
              key={medicine.id}
              className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all hover:shadow-lg ${
                index === selectedMedicineIndex ? 'ring-2 shadow-lg' + (isReturnMode ? ' ring-orange-500 bg-orange-50' : ' ring-blue-500 bg-blue-50') : 'hover:bg-slate-50'
              }`}
              onClick={() => isReturnMode ? addToReturnCart(medicine) : addToCart(medicine)}
            >
              <h3 className="font-semibold text-lg text-slate-900">{medicine.name}</h3>
              <p className="text-slate-600">Stock: {medicine.stock_quantity}</p>
              <p className="text-green-600 font-bold">₹{medicine.price}</p>
              <p className="text-sm text-slate-500">Exp: {new Date(medicine.expiry_date).toLocaleDateString()}</p>
              {index === selectedMedicineIndex && (
                <div className={`text-xs font-medium mt-1 ${isReturnMode ? 'text-orange-600' : 'text-blue-600'}`}>
                  ↵ Enter to {isReturnMode ? 'return' : 'add'} • ↑↓ Navigate
                </div>
              )}
            </div>
          ))}
        </div>

        {medicines.length === 0 && (searchTerm || returnSearchTerm) && (
          <div className="text-center py-8 text-slate-500">
            No medicines found matching your search.
          </div>
        )}
      </div>

      {/* Cart & Checkout */}
      <div className="w-1/3 bg-white p-6 shadow-xl border-l border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            {isReturnMode ? '↩️ Return Cart' : '🛒 Shopping Cart'}
          </h3>
          <button
            onClick={() => {setCart([]); setDiscountType('none'); setDiscountValue(0);}}
            className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
            disabled={cart.length === 0}
          >
            Clear (F3)
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {cart.map((item, index) => (
            <div key={`${item.medicine_id}-${item.is_return}`} className={`flex justify-between items-center p-3 rounded-lg border ${item.is_return ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-900 truncate">
                  {item.is_return && '↩️ '}{item.medicine_name}
                </h4>
                <p className="text-sm text-slate-500">₹{item.price} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateCartQuantity(item.medicine_id, item.quantity - 1, item.is_return)}
                  className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-sm font-bold transition-colors"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateCartQuantity(item.medicine_id, item.quantity + 1, item.is_return)}
                  className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-sm font-bold transition-colors"
                  disabled={!item.is_return && item.quantity >= (medicines.find(m => m.id === item.medicine_id)?.stock_quantity || 0)}
                >
                  +
                </button>
              </div>
              <div className="text-right ml-3">
                <p className={`font-bold ${item.is_return ? 'text-orange-600' : 'text-green-600'}`}>
                  {item.is_return ? '-' : ''}₹{item.total.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {cart.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            {isReturnMode ? 'No items selected for return' : 'No items in cart'}
          </div>
        )}

        {/* Discount Section */}
        {cart.length > 0 && !isReturnMode && (
          <div className="border-t border-slate-200 pt-4 mb-4">
            <h4 className="font-semibold text-slate-900 mb-3">💰 Apply Discount</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {setDiscountType('none'); setDiscountValue(0);}}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    discountType === 'none' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  No Discount
                </button>
                <button
                  onClick={() => {setDiscountType('percentage'); setDiscountValue(discountValue || 10);}}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Percentage
                </button>
                <button
                  onClick={() => {setDiscountType('fixed'); setDiscountValue(discountValue || 10);}}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Fixed Amount
                </button>
              </div>
              
              {discountType !== 'none' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={discountType === 'percentage' ? 'Discount %' : 'Discount ₹'}
                    min="0"
                    max={discountType === 'percentage' ? "100" : undefined}
                  />
                  <span className="text-slate-600 font-medium">
                    {discountType === 'percentage' ? '%' : '₹'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="font-semibold text-slate-900 mb-3">👤 Customer Info (Optional)</h4>
          <div className="space-y-3">
            <input
              ref={customerNameRef}
              type="text"
              placeholder="Customer Name"
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Customer Phone"
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="font-semibold text-slate-900 mb-3">💳 Payment Method</h4>
          <div className="flex gap-2">
            {['cash', 'card', 'upi'].map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 p-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  paymentMethod === method 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {method} {paymentMethod === method && '✓'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Press F5 to cycle through payment methods</p>
        </div>

        {/* Order Summary */}
        {cart.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>₹{Math.abs(getCartSubtotal()).toFixed(2)}</span>
              </div>
              
              {discountType !== 'none' && !isReturnMode && (
                <div className="flex justify-between text-orange-600">
                  <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}`}):</span>
                  <span>-₹{calculateDiscount(Math.abs(getCartSubtotal())).toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                <span>Total:</span>
                <span className={getCartTotal() >= 0 ? 'text-green-600' : 'text-orange-600'}>
                  ₹{Math.abs(getCartTotal()).toFixed(2)} {getCartTotal() < 0 && '(Return)'}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg ${
                isReturnMode || getCartTotal() < 0
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
              }`}
              disabled={cart.length === 0}
            >
              {isReturnMode || getCartTotal() < 0 
                ? '↩️ Process Return (F2)' 
                : '✅ Complete Sale (F2)'
              }
            </button>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="mt-6 text-xs text-slate-500 space-y-1">
          <div className="font-semibold">Keyboard Shortcuts:</div>
          <div>F1: Search • F2: Checkout • F3: Clear Cart</div>
          <div>F4: Customer Name • F5: Payment Method</div>
          <div>F6: Toggle Return Mode • /: Quick Search</div>
          <div>↑↓: Navigate • Enter: Add Item</div>
        </div>
      </div>
    </div>
  );

  // Backup & Restore Management Component
  const BackupRestoreManagement = () => {
    const [backupLoading, setBackupLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('create');
    const [selectedBackupForRestore, setSelectedBackupForRestore] = useState(null);
    const [uploadingFile, setUploadingFile] = useState(false);

    useEffect(() => {
      if (activeTab === 'manage' || activeTab === 'restore') {
        fetchBackups();
      }
    }, [activeTab]);

    const handleCreateBackup = async (e) => {
      e.preventDefault();
      setBackupLoading(true);
      setMessage('');

      try {
        const result = await createBackup(backupOptions);
        
        if (result?.success) {
          setMessage(`✅ Backup created successfully! ${result.total_records} records backed up.`);
          setBackupOptions({
            ...backupOptions,
            backup_name: ''
          });
          // Refresh backup list if on manage tab
          if (activeTab === 'manage') {
            fetchBackups();
          }
        } else {
          setMessage('❌ Failed to create backup');
        }
      } catch (error) {
        setMessage('❌ Error creating backup');
      }
      
      setBackupLoading(false);
      setTimeout(() => setMessage(''), 5000);
    };

    const handleRestoreBackup = async (e) => {
      e.preventDefault();
      
      if (!selectedBackupForRestore) {
        setMessage('❌ Please select a backup to restore');
        return;
      }

      if (restoreOptions.clear_existing_data && 
          !window.confirm('⚠️ This will permanently delete all existing data before restoring. Are you sure?')) {
        return;
      }

      setRestoreLoading(true);
      setMessage('');

      try {
        const result = await restoreBackup({
          ...restoreOptions,
          backup_id: selectedBackupForRestore.id
        });
        
        if (result?.success) {
          const totalRestored = Object.values(result.restored_records).reduce((sum, count) => sum + count, 0);
          setMessage(`✅ Backup restored successfully! ${totalRestored} records restored.`);
          setSelectedBackupForRestore(null);
          
          // Refresh all data
          fetchMedicines();
          fetchSales();
          fetchShop();
        } else {
          setMessage(`❌ Restore failed: ${result?.errors?.join(', ') || 'Unknown error'}`);
        }
      } catch (error) {
        setMessage('❌ Error restoring backup');
      }
      
      setRestoreLoading(false);
      setTimeout(() => setMessage(''), 5000);
    };

    const handleDeleteBackup = async (backup) => {
      if (!window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) {
        return;
      }

      try {
        const result = await deleteBackup(backup.id);
        if (result?.success) {
          setMessage('✅ Backup deleted successfully');
          fetchBackups();
        } else {
          setMessage('❌ Failed to delete backup');
        }
      } catch (error) {
        setMessage('❌ Error deleting backup');
      }
      setTimeout(() => setMessage(''), 3000);
    };

    const handleDownloadBackup = async (backup) => {
      try {
        const success = await downloadBackup(backup.id, backup.name);
        if (success) {
          setMessage('✅ Backup downloaded successfully');
        } else {
          setMessage('❌ Failed to download backup');
        }
      } catch (error) {
        setMessage('❌ Error downloading backup');
      }
      setTimeout(() => setMessage(''), 3000);
    };

    const handleFileUpload = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.json')) {
        setMessage('❌ Please select a JSON backup file');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      setUploadingFile(true);
      setMessage('');

      try {
        const result = await uploadBackupFile(file);
        if (result?.success) {
          setMessage(`✅ Backup file uploaded successfully: ${result.name}`);
          fetchBackups();
        } else {
          setMessage('❌ Failed to upload backup file');
        }
      } catch (error) {
        setMessage('❌ Error uploading backup file');
      }

      setUploadingFile(false);
      event.target.value = ''; // Reset file input
      setTimeout(() => setMessage(''), 5000);
    };

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg">
            {/* Header */}
            <div className="border-b border-slate-200 p-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">🗄️ Backup & Restore</h1>
              <p className="text-slate-600">Manage your application data backups and restore points</p>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`mx-6 mt-4 p-4 rounded-lg ${
                message.includes('✅') ? 'bg-green-50 border border-green-200 text-green-800' :
                message.includes('⚠️') ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
                'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {message}
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <nav className="flex p-6 space-x-8">
                {[
                  { id: 'create', label: '📦 Create Backup', icon: '📦' },
                  { id: 'manage', label: '📋 Manage Backups', icon: '📋' },
                  { id: 'restore', label: '🔄 Restore Data', icon: '🔄' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Create Backup Tab */}
              {activeTab === 'create' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4">Create New Backup</h2>
                    <p className="text-slate-600 mb-6">Select which data categories to include in your backup</p>
                  </div>

                  <form onSubmit={handleCreateBackup} className="space-y-6">
                    {/* Backup Name */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Backup Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter backup name or leave empty for auto-generated name"
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={backupOptions.backup_name}
                        onChange={(e) => setBackupOptions({ ...backupOptions, backup_name: e.target.value })}
                      />
                    </div>

                    {/* Data Selection */}
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 mb-4">Select Data to Backup</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'include_medicines', label: '💊 Medicines & Inventory', description: 'All medicine records, stock levels, prices' },
                          { key: 'include_sales', label: '🛒 Sales Transactions', description: 'All sales records and receipts' },
                          { key: 'include_stock_movements', label: '📦 Stock Movements', description: 'Stock addition, reduction, and adjustment history' },
                          { key: 'include_shop_details', label: '🏪 Shop Details', description: 'Shop information, license, GST details' },
                          { key: 'include_import_logs', label: '📥 Import Logs', description: 'Tally import history and logs' },
                          { key: 'include_status_checks', label: '✅ Status Checks', description: 'System status and health check logs' }
                        ].map((option) => (
                          <div key={option.key} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={backupOptions[option.key]}
                                onChange={(e) => setBackupOptions({ 
                                  ...backupOptions, 
                                  [option.key]: e.target.checked 
                                })}
                                className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                              />
                              <div>
                                <div className="font-medium text-slate-900">{option.label}</div>
                                <div className="text-sm text-slate-500">{option.description}</div>
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Create Button */}
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={backupLoading || !Object.values(backupOptions).slice(0, -1).some(Boolean)}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {backupLoading ? (
                          <span className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Creating Backup...
                          </span>
                        ) : (
                          '📦 Create Backup'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Manage Backups Tab */}
              {activeTab === 'manage' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Manage Backups</h2>
                      <p className="text-slate-600">View, download, and delete your backups</p>
                    </div>
                    <div>
                      <label className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 cursor-pointer transition-colors">
                        {uploadingFile ? (
                          <span className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Uploading...
                          </span>
                        ) : (
                          '📤 Upload Backup File'
                        )}
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={uploadingFile}
                        />
                      </label>
                    </div>
                  </div>

                  {backups.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📁</div>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No backups found</h3>
                      <p className="text-slate-600">Create your first backup to get started</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {backups.map((backup) => (
                        <div key={backup.id} className="border border-slate-200 rounded-lg p-6 hover:bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-slate-900 mb-2">{backup.name}</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600">
                                <div>
                                  <span className="font-medium">Created:</span><br />
                                  {formatDate(backup.created_at)}
                                </div>
                                <div>
                                  <span className="font-medium">Records:</span><br />
                                  {backup.total_records.toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">Size:</span><br />
                                  {formatFileSize(backup.file_size)}
                                </div>
                                <div>
                                  <span className="font-medium">Categories:</span><br />
                                  {backup.data_categories.length} selected
                                </div>
                              </div>
                              <div className="mt-3">
                                <span className="font-medium text-sm text-slate-700">Data Types: </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {backup.data_categories.map((category) => (
                                    <span key={category} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                      {category.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2 ml-4">
                              <button
                                onClick={() => handleDownloadBackup(backup)}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Download backup"
                              >
                                📥 Download
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup)}
                                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                title="Delete backup"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Restore Data Tab */}
              {activeTab === 'restore' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Restore Data</h2>
                    <p className="text-slate-600">Select a backup and choose which data to restore</p>
                  </div>

                  {backups.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📂</div>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No backups available</h3>
                      <p className="text-slate-600">Create a backup first to enable restore functionality</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRestoreBackup} className="space-y-6">
                      {/* Backup Selection */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-4">
                          Select Backup to Restore
                        </label>
                        <div className="space-y-3">
                          {backups.map((backup) => (
                            <label key={backup.id} className="flex items-start space-x-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                              <input
                                type="radio"
                                name="selectedBackup"
                                checked={selectedBackupForRestore?.id === backup.id}
                                onChange={() => setSelectedBackupForRestore(backup)}
                                className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">{backup.name}</div>
                                <div className="text-sm text-slate-600 mt-1">
                                  Created: {formatDate(backup.created_at)} • 
                                  Records: {backup.total_records.toLocaleString()} • 
                                  Size: {formatFileSize(backup.file_size)}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {backup.data_categories.map((category) => (
                                    <span key={category} className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full">
                                      {category.replace(/_/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {selectedBackupForRestore && (
                        <>
                          {/* Restore Options */}
                          <div>
                            <h3 className="text-lg font-medium text-slate-900 mb-4">Select Data to Restore</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {selectedBackupForRestore.data_categories.map((category) => {
                                const optionKey = `include_${category}`;
                                const labels = {
                                  medicines: '💊 Medicines & Inventory',
                                  sales: '🛒 Sales Transactions',
                                  stock_movements: '📦 Stock Movements',
                                  shop: '🏪 Shop Details',
                                  import_logs: '📥 Import Logs',
                                  status_checks: '✅ Status Checks'
                                };
                                
                                return (
                                  <div key={category} className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={restoreOptions[optionKey] || false}
                                        onChange={(e) => setRestoreOptions({ 
                                          ...restoreOptions, 
                                          [optionKey]: e.target.checked 
                                        })}
                                        className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="font-medium text-slate-900">
                                        {labels[category] || category.replace(/_/g, ' ')}
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Advanced Options */}
                          <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                            <h4 className="font-medium text-yellow-800 mb-3">⚠️ Advanced Options</h4>
                            <label className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={restoreOptions.clear_existing_data}
                                onChange={(e) => setRestoreOptions({ 
                                  ...restoreOptions, 
                                  clear_existing_data: e.target.checked 
                                })}
                                className="mt-1 h-4 w-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                              />
                              <div>
                                <div className="font-medium text-yellow-800">Clear existing data before restore</div>
                                <div className="text-sm text-yellow-700">
                                  ⚠️ This will permanently delete all existing data in selected categories before restoring
                                </div>
                              </div>
                            </label>
                          </div>

                          {/* Restore Button */}
                          <div className="pt-4">
                            <button
                              type="submit"
                              disabled={restoreLoading || !Object.values(restoreOptions).slice(1, -1).some(Boolean)}
                              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                            >
                              {restoreLoading ? (
                                <span className="flex items-center justify-center">
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                  Restoring Data...
                                </span>
                              ) : (
                                '🔄 Restore Selected Data'
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Other existing views (Inventory, User Management, Shop Settings) remain the same
  // For brevity, I'll reference the existing implementation

  return (
    <div className="App">
      {/* Loading State */}
      {loading && (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading MediPOS RMS...</p>
          </div>
        </div>
      )}

      {/* Authentication Check */}
      {!loading && !isAuthenticated && <ModernLogin />}

      {/* Main Application */}
      {!loading && isAuthenticated && (
        <>
          <Navigation />
          
          {currentView === 'pos' && <POSView />}
          {currentView === 'sales' && <SalesManagement />}
          {currentView === 'analytics' && <AnalyticsDashboard />}
          {currentView === 'inventory' && <InventoryManagement />}
          {currentView === 'users' && <OfflineUserManagement />}
          {currentView === 'shop' && <ShopSettings />}
          {currentView === 'backup' && <BackupRestoreManagement />}
          {currentView === 'backup' && <BackupRestoreManagement />}
        </>
      )}
      
      <Toaster />
    </div>
  );
};

// Main App Component with Auth Provider
function App() {
  return (
    <BrowserRouter>
      <OfflineAuthProvider>
        <RMSApp />
      </OfflineAuthProvider>
    </BrowserRouter>
  );
}

export default App;