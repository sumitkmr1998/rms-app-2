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
  
  // Refs for keyboard navigation
  const searchRef = useRef(null);
  const quantityRefs = useRef([]);

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
      // Alt + P for POS
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        setCurrentView('pos');
      }
      // Alt + I for Inventory
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        setCurrentView('inventory');
      }
      // Alt + S for Sales
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        setCurrentView('sales');
      }
      // Alt + U for Users
      if (e.altKey && e.key === 'u') {
        e.preventDefault();
        setCurrentView('users');
      }
      // F1 for Search focus
      if (e.key === 'F1') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // F2 for Checkout
      if (e.key === 'F2' && cart.length > 0) {
        e.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [cart]);

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

  // POS functions
  const addToCart = (medicine) => {
    const existingItem = cart.find(item => item.medicine_id === medicine.id);
    if (existingItem) {
      if (existingItem.quantity < medicine.stock_quantity) {
        setCart(cart.map(item =>
          item.medicine_id === medicine.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        ));
      }
    } else {
      if (medicine.stock_quantity > 0) {
        setCart([...cart, {
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          quantity: 1,
          price: medicine.price,
          total: medicine.price
        }]);
      }
    }
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
        payment_method: 'cash',
        cashier_id: 'default-user'
      };

      await axios.post(`${API}/sales`, saleData);
      
      // Clear cart and refresh data
      setCart([]);
      fetchMedicines();
      fetchSales();
      fetchAnalytics();
      
      alert('Sale completed successfully!');
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
            POS (Alt+P)
          </button>
          <button
            onClick={() => setCurrentView('inventory')}
            className={`px-4 py-2 rounded ${currentView === 'inventory' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Inventory (Alt+I)
          </button>
          <button
            onClick={() => setCurrentView('sales')}
            className={`px-4 py-2 rounded ${currentView === 'sales' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Sales (Alt+S)
          </button>
          <button
            onClick={() => setCurrentView('users')}
            className={`px-4 py-2 rounded ${currentView === 'users' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            Users (Alt+U)
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
        <div className="mb-4">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search medicines... (Press F1 to focus)"
            className="w-full p-3 border rounded-lg text-lg"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {medicines.map((medicine) => (
            <div
              key={medicine.id}
              className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-blue-50 transition-colors"
              onClick={() => addToCart(medicine)}
            >
              <h3 className="font-semibold text-lg">{medicine.name}</h3>
              <p className="text-gray-600">Stock: {medicine.stock_quantity}</p>
              <p className="text-green-600 font-bold">₹{medicine.price}</p>
              <p className="text-sm text-gray-500">Exp: {new Date(medicine.expiry_date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout */}
      <div className="w-1/3 bg-white p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">Cart</h2>
        
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
                  className="bg-red-500 text-white w-6 h-6 rounded text-xs"
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
                  className="bg-green-500 text-white w-6 h-6 rounded text-xs"
                >
                  +
                </button>
              </div>
              <div className="font-bold">₹{item.total.toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-xl font-bold mb-4">
            <span>Total:</span>
            <span>₹{getCartTotal().toFixed(2)}</span>
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            Checkout (F2)
          </button>
          
          <button
            onClick={() => setCart([])}
            className="w-full bg-red-600 text-white py-2 rounded-lg mt-2 hover:bg-red-700"
          >
            Clear Cart
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <div>Keyboard shortcuts:</div>
          <div>F1: Focus search</div>
          <div>F2: Checkout</div>
          <div>Alt+P/I/S/U: Switch views</div>
        </div>
      </div>
    </div>
  );

  // Sales Analytics View
  const SalesView = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Sales Analytics</h2>
      
      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Total Sales</h3>
          <p className="text-3xl font-bold text-green-600">₹{analytics.total_sales || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Total Transactions</h3>
          <p className="text-3xl font-bold text-blue-600">{analytics.total_transactions || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Average Transaction</h3>
          <p className="text-3xl font-bold text-purple-600">₹{analytics.avg_transaction || 0}</p>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Sales</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Receipt #</th>
                <th className="py-2">Date</th>
                <th className="py-2">Items</th>
                <th className="py-2">Total</th>
                <th className="py-2">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="border-b">
                  <td className="py-2">{sale.receipt_number}</td>
                  <td className="py-2">{new Date(sale.sale_date).toLocaleDateString()}</td>
                  <td className="py-2">{sale.items.length} items</td>
                  <td className="py-2">₹{sale.total_amount.toFixed(2)}</td>
                  <td className="py-2 capitalize">{sale.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Inventory View
  const InventoryView = () => (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Medicine Inventory</h2>
      
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {medicines.map((medicine) => (
              <tr key={medicine.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {medicine.name}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${medicine.stock_quantity < 10 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                  {medicine.stock_quantity}
                  {medicine.stock_quantity < 10 && <span className="ml-1 text-xs">(Low Stock)</span>}
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
              </tr>
            ))}
          </tbody>
        </table>
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