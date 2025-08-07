import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  const [currentView, setCurrentView] = useState('pos');
  const [medicines, setMedicines] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [users, setUsers] = useState([]);
  const [shop, setShop] = useState(null);
  const [selectedMedicineIndex, setSelectedMedicineIndex] = useState(0);
  const [quickQuantity, setQuickQuantity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isQuickEntry, setIsQuickEntry] = useState(false);
  
  // Refs for keyboard navigation
  const searchRef = useRef(null);
  const quantityRefs = useRef([]);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchMedicines();
    fetchSales();
    fetchAnalytics();
    fetchUsers();
    fetchShop();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Handle Enter key in search
        if (e.key === 'Enter' && e.target === searchRef.current) {
          e.preventDefault();
          if (medicines.length > 0) {
            addToCart(medicines[selectedMedicineIndex]);
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
            setCurrentView('pos');
          }
          break;
        case 'i':
        case 'I':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            setCurrentView('inventory');
          }
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            setCurrentView('sales');
          }
          break;
        case 'u':
        case 'U':
          if (e.ctrlKey || e.altKey) {
            e.preventDefault();
            setCurrentView('users');
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
          break;
        case 'F4':
          e.preventDefault();
          customerNameRef.current?.focus();
          break;
        case 'F5':
          e.preventDefault();
          setPaymentMethod(paymentMethod === 'cash' ? 'card' : paymentMethod === 'card' ? 'upi' : 'cash');
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
            addToCart(medicines[selectedMedicineIndex]);
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
            addMultipleToCart(medicine, qty);
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
          searchRef.current?.focus();
          searchRef.current?.select();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart, medicines, selectedMedicineIndex, quickQuantity, currentView, paymentMethod]);

  // API functions
  const fetchMedicines = async (search = '') => {
    try {
      const response = await axios.get(`${API}/medicines`, {
        params: search ? { search } : {}
      });
      setMedicines(response.data);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await axios.get(`${API}/sales`);
      setSales(response.data);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/sales/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchShop = async () => {
    try {
      const response = await axios.get(`${API}/shop`);
      setShop(response.data);
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
        total: medicine.price * quantity
      }]);
    }
  };

  // POS functions
  const addToCart = (medicine, quantity = 1) => {
    addMultipleToCart(medicine, quantity);
  };

  const updateCartQuantity = (medicineId, newQuantity) => {
    if (newQuantity === 0) {
      setCart(cart.filter(item => item.medicine_id !== medicineId));
    } else {
      setCart(cart.map(item =>
        item.medicine_id === medicineId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.total, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const saleData = {
        items: cart,
        total_amount: getCartTotal(),
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        cashier_id: 'default-user'
      };

      await axios.post(`${API}/sales`, saleData);
      
      // Clear cart and reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      fetchMedicines();
      fetchSales();
      fetchAnalytics();
      
      alert('Sale completed successfully!');
      
      // Focus back to search for next transaction
      setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error processing sale. Please try again.');
    }
  };

  // Search handler
  const handleSearch = (term) => {
    setSearchTerm(term);
    fetchMedicines(term);
  };

  // Navigation component
  const Navigation = () => (
    <nav className="bg-blue-800 text-white p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">MediPOS - Pharmacy Management</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setCurrentView('pos')}
            className={`px-4 py-2 rounded ${currentView === 'pos' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            POS <span className="text-sm opacity-75">(Ctrl+P)</span>
          </button>
          <button
            onClick={() => setCurrentView('inventory')}
            className={`px-4 py-2 rounded ${currentView === 'inventory' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Inventory <span className="text-sm opacity-75">(Ctrl+I)</span>
          </button>
          <button
            onClick={() => setCurrentView('sales')}
            className={`px-4 py-2 rounded ${currentView === 'sales' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Sales <span className="text-sm opacity-75">(Ctrl+S)</span>
          </button>
          <button
            onClick={() => setCurrentView('users')}
            className={`px-4 py-2 rounded ${currentView === 'users' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Users <span className="text-sm opacity-75">(Ctrl+U)</span>
          </button>
        </div>
      </div>
    </nav>
  );

  // POS View
  const POSView = () => (
    <div className="flex h-screen bg-gray-100">
      {/* Product Search & Selection */}
      <div className="w-2/3 p-6">
        <div className="mb-4 relative">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search medicines... (Press F1 to focus, / for quick focus, Enter to add selected)"
            className="w-full p-3 border rounded-lg text-lg"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
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
              className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-colors ${
                index === selectedMedicineIndex ? 'bg-blue-100 border-2 border-blue-500' : 'hover:bg-blue-50'
              }`}
              onClick={() => addToCart(medicine)}
            >
              <h3 className="font-semibold text-lg">{medicine.name}</h3>
              <p className="text-gray-600">Stock: {medicine.stock_quantity}</p>
              <p className="text-green-600 font-bold">₹{medicine.price}</p>
              <p className="text-sm text-gray-500">Exp: {new Date(medicine.expiry_date).toLocaleDateString()}</p>
              {index === selectedMedicineIndex && (
                <div className="text-xs text-blue-600 font-medium mt-1">
                  ↵ Enter to add • ↑↓ Navigate
                </div>
              )}
            </div>
          ))}
        </div>

        {medicines.length === 0 && searchTerm && (
          <div className="text-center text-gray-500 mt-8">
            No medicines found for "{searchTerm}"
          </div>
        )}
      </div>

      {/* Cart & Checkout */}
      <div className="w-1/3 bg-white p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cart</h2>
          <div className="text-xs text-gray-500">
            F3: Clear Cart
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto mb-4">
          {cart.map((item, index) => (
            <div key={item.medicine_id} className="flex justify-between items-center p-2 border-b">
              <div>
                <div className="font-medium">{item.medicine_name}</div>
                <div className="text-sm text-gray-600">₹{item.price} each</div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateCartQuantity(item.medicine_id, item.quantity - 1)}
                  className="bg-red-500 text-white w-6 h-6 rounded text-xs hover:bg-red-600"
                >
                  -
                </button>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateCartQuantity(item.medicine_id, parseInt(e.target.value) || 0)}
                  className="w-12 text-center border rounded"
                  min="0"
                />
                <button
                  onClick={() => updateCartQuantity(item.medicine_id, item.quantity + 1)}
                  className="bg-green-500 text-white w-6 h-6 rounded text-xs hover:bg-green-600"
                >
                  +
                </button>
              </div>
              <div className="font-bold">₹{item.total.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Customer Information */}
        <div className="border-t pt-4 mb-4">
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Customer Name (F4)</label>
            <input
              ref={customerNameRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional"
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Customer Phone</label>
            <input
              ref={customerPhoneRef}
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Optional"
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Payment Method (F5 to cycle)</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-xl font-bold mb-4">
            <span>Total:</span>
            <span>₹{getCartTotal().toFixed(2)}</span>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400 mb-2"
          >
            Checkout (F2)
          </button>
          
          <button
            onClick={() => setCart([])}
            className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
          >
            Clear Cart (F3)
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-600 border-t pt-4">
          <div className="font-semibold mb-2">Power User Shortcuts:</div>
          <div className="space-y-1">
            <div><kbd className="bg-gray-100 px-1 rounded">F1</kbd> Focus search</div>
            <div><kbd className="bg-gray-100 px-1 rounded">F2</kbd> Checkout</div>
            <div><kbd className="bg-gray-100 px-1 rounded">F3</kbd> Clear cart</div>
            <div><kbd className="bg-gray-100 px-1 rounded">F4</kbd> Customer name</div>
            <div><kbd className="bg-gray-100 px-1 rounded">F5</kbd> Payment method</div>
            <div><kbd className="bg-gray-100 px-1 rounded">/</kbd> Quick search focus</div>
            <div><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> Navigate medicines</div>
            <div><kbd className="bg-gray-100 px-1 rounded">Enter</kbd> Add selected item</div>
            <div><kbd className="bg-gray-100 px-1 rounded">1-9</kbd> Quick quantity</div>
            <div><kbd className="bg-gray-100 px-1 rounded">+</kbd> Add with quantity</div>
            <div><kbd className="bg-gray-100 px-1 rounded">Ctrl+P/I/S/U</kbd> Switch views</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Sales Analytics View
  const SalesView = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Sales Analytics</h2>
        <div className="text-sm text-gray-600">
          <kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+P</kbd> for POS • 
          <kbd className="bg-gray-100 px-2 py-1 rounded ml-1">Ctrl+I</kbd> for Inventory
        </div>
      </div>
      
      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold mb-2 text-green-700">Total Sales</h3>
          <p className="text-3xl font-bold text-green-600">₹{analytics.total_sales || 0}</p>
          <div className="text-sm text-gray-500 mt-1">All time revenue</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold mb-2 text-blue-700">Total Transactions</h3>
          <p className="text-3xl font-bold text-blue-600">{analytics.total_transactions || 0}</p>
          <div className="text-sm text-gray-500 mt-1">Completed sales</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold mb-2 text-purple-700">Average Transaction</h3>
          <p className="text-3xl font-bold text-purple-600">₹{analytics.avg_transaction || 0}</p>
          <div className="text-sm text-gray-500 mt-1">Per sale average</div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Recent Sales</h3>
          <div className="text-sm text-gray-500">
            Latest {Math.min(sales.length, 10)} transactions
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 text-sm font-medium text-gray-700">Receipt #</th>
                <th className="py-3 text-sm font-medium text-gray-700">Date</th>
                <th className="py-3 text-sm font-medium text-gray-700">Customer</th>
                <th className="py-3 text-sm font-medium text-gray-700">Items</th>
                <th className="py-3 text-sm font-medium text-gray-700">Total</th>
                <th className="py-3 text-sm font-medium text-gray-700">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 10).map((sale, index) => (
                <tr key={sale.id} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="py-3 text-sm font-mono">{sale.receipt_number}</td>
                  <td className="py-3 text-sm">{new Date(sale.sale_date).toLocaleDateString()}</td>
                  <td className="py-3 text-sm">{sale.customer_name || 'Walk-in'}</td>
                  <td className="py-3 text-sm">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {sale.items.length} items
                    </span>
                  </td>
                  <td className="py-3 text-sm font-semibold text-green-600">₹{sale.total_amount.toFixed(2)}</td>
                  <td className="py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      sale.payment_method === 'cash' ? 'bg-green-100 text-green-800' :
                      sale.payment_method === 'card' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {sale.payment_method.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {sales.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No sales data available. Start making sales in the POS!
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <h4 className="font-semibold mb-2">Quick Actions</h4>
        <div className="flex space-x-4">
          <button
            onClick={() => setCurrentView('pos')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            🛒 Go to POS (Ctrl+P)
          </button>
          <button
            onClick={() => setCurrentView('inventory')}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            📦 View Inventory (Ctrl+I)
          </button>
          <button
            onClick={() => {fetchSales(); fetchAnalytics();}}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>
    </div>
  );

  // Inventory View
  const InventoryView = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Medicine Inventory</h2>
        <div className="text-sm text-gray-600">
          <kbd className="bg-gray-100 px-2 py-1 rounded">Ctrl+P</kbd> for POS • 
          <kbd className="bg-gray-100 px-2 py-1 rounded ml-1">/</kbd> to search
        </div>
      </div>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter inventory... (Press / to focus)"
          className="w-full max-w-md p-3 border rounded-lg"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {medicines.map((medicine, index) => (
              <tr key={medicine.id} className={index === selectedMedicineIndex && currentView === 'inventory' ? 'bg-blue-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {medicine.name}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${medicine.stock_quantity < 10 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                  {medicine.stock_quantity}
                  {medicine.stock_quantity < 10 && <span className="ml-1 text-xs">⚠️ Low Stock</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ₹{medicine.price}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(medicine.expiry_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {medicine.supplier}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {medicine.batch_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <button
                    onClick={() => addToCart(medicine)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Add to Cart
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">Inventory Summary</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{medicines.length}</div>
            <div className="text-sm text-gray-600">Total Items</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {medicines.reduce((sum, med) => sum + med.stock_quantity, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Units</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {medicines.filter(med => med.stock_quantity < 10).length}
            </div>
            <div className="text-sm text-gray-600">Low Stock Items</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              ₹{medicines.reduce((sum, med) => sum + (med.price * med.stock_quantity), 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Users View
  const UsersView = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">User Management</h2>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      
      {currentView === 'pos' && <POSView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'sales' && <SalesView />}
      {currentView === 'users' && <UsersView />}
    </div>
  );
};

export default App;