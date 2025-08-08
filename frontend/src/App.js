import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState({
    access_token: localStorage.getItem('access_token'),
    refresh_token: localStorage.getItem('refresh_token')
  });

  // Set up axios interceptors for authentication
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (tokens.access_token) {
          config.headers.Authorization = `Bearer ${tokens.access_token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          if (tokens.refresh_token) {
            try {
              const response = await axios.post(`${API}/auth/refresh`, {}, {
                headers: { Authorization: `Bearer ${tokens.refresh_token}` }
              });
              
              const newTokens = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token
              };
              
              setTokens(newTokens);
              localStorage.setItem('access_token', newTokens.access_token);
              localStorage.setItem('refresh_token', newTokens.refresh_token);
              
              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
              return axios(originalRequest);
            } catch (refreshError) {
              logout();
            }
          } else {
            logout();
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [tokens]);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (tokens.access_token) {
        try {
          const response = await axios.get(`${API}/auth/me`);
          setUser(response.data);
        } catch (error) {
          // Token invalid, try refresh
          if (tokens.refresh_token) {
            try {
              const refreshResponse = await axios.post(`${API}/auth/refresh`, {}, {
                headers: { Authorization: `Bearer ${tokens.refresh_token}` }
              });
              
              const newTokens = {
                access_token: refreshResponse.data.access_token,
                refresh_token: refreshResponse.data.refresh_token
              };
              
              setTokens(newTokens);
              localStorage.setItem('access_token', newTokens.access_token);
              localStorage.setItem('refresh_token', newTokens.refresh_token);
              setUser(refreshResponse.data.user);
            } catch (refreshError) {
              logout();
            }
          } else {
            logout();
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password, rememberMe = false) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
        remember_me: rememberMe
      });

      const { access_token, refresh_token, user } = response.data;
      
      setTokens({ access_token, refresh_token });
      setUser(user);
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      if (tokens.access_token) {
        await axios.post(`${API}/auth/logout`);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setTokens({ access_token: null, refresh_token: null });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Login Screen Component
const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password, rememberMe);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage('');

    try {
      const response = await axios.post(`${API}/auth/password-reset`, {
        username_or_email: resetUsername
      });
      setResetMessage('Password reset instructions have been sent.');
    } catch (error) {
      setResetMessage('Error sending reset instructions.');
    }
    
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">MediPOS Login</h2>
            <p className="text-gray-600">Sign in to your pharmacy management system</p>
          </div>

          {!showPasswordReset ? (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me for 30 days
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : null}
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>

              <div className="text-center text-sm text-gray-600">
                <p>Default admin account:</p>
                <p className="font-mono">Username: admin | Password: admin123</p>
              </div>
            </form>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Reset Password</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Enter your username or email to receive password reset instructions.
                </p>
              </div>

              {resetMessage && (
                <div className={`border rounded-lg p-4 ${resetMessage.includes('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                  <p className="text-sm">{resetMessage}</p>
                </div>
              )}

              <div>
                <label htmlFor="reset-username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username or Email
                </label>
                <input
                  id="reset-username"
                  name="reset-username"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter username or email"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setResetMessage('');
                    setResetUsername('');
                  }}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component (requires authentication)
const MainApp = () => {
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
  
  // Advanced User Management State
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    full_name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'cashier',
    permissions: {}
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: ''
  });
  const [userManagementLoading, setUserManagementLoading] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  
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
  
  const { user, logout } = useAuth();
  
  // Refs for keyboard navigation
  const searchRef = useRef(null);
  const quantityRefs = useRef([]);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);

  // Check user permissions
  const canAccessView = (view) => {
    const userRole = user?.role;
    switch (view) {
      case 'users':
        return userRole === 'admin';
      case 'inventory':
        return ['admin', 'manager'].includes(userRole);
      case 'pos':
      case 'sales':
        return ['admin', 'manager', 'cashier'].includes(userRole);
      default:
        return true;
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchMedicines();
    fetchSales();
    fetchAnalytics();
    if (canAccessView('users')) {
      fetchUsers();
    }
    fetchShop();
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
  }, [cart, medicines, selectedMedicineIndex, quickQuantity, currentView, paymentMethod, user]);

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
        cashier_id: user.id
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
        <div>
          <h1 className="text-xl font-bold">MediPOS - Pharmacy Management</h1>
          <p className="text-sm text-blue-200">Welcome, {user?.full_name || user?.username} ({user?.role})</p>
        </div>
        <div className="flex space-x-4 items-center">
          {canAccessView('pos') && (
            <button
              onClick={() => setCurrentView('pos')}
              className={`px-4 py-2 rounded ${currentView === 'pos' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            >
              POS <span className="text-sm opacity-75">(Ctrl+P)</span>
            </button>
          )}
          {canAccessView('inventory') && (
            <button
              onClick={() => setCurrentView('inventory')}
              className={`px-4 py-2 rounded ${currentView === 'inventory' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            >
              Inventory <span className="text-sm opacity-75">(Ctrl+I)</span>
            </button>
          )}
          {canAccessView('sales') && (
            <button
              onClick={() => setCurrentView('sales')}
              className={`px-4 py-2 rounded ${currentView === 'sales' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            >
              Sales <span className="text-sm opacity-75">(Ctrl+S)</span>
            </button>
          )}
          {canAccessView('users') && (
            <button
              onClick={() => setCurrentView('users')}
              className={`px-4 py-2 rounded ${currentView === 'users' ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            >
              Users <span className="text-sm opacity-75">(Ctrl+U)</span>
            </button>
          )}
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Logout
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
          {canAccessView('pos') && (
            <button
              onClick={() => setCurrentView('pos')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              🛒 Go to POS (Ctrl+P)
            </button>
          )}
          {canAccessView('inventory') && (
            <button
              onClick={() => setCurrentView('inventory')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
            >
              📦 View Inventory (Ctrl+I)
            </button>
          )}
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
                  {canAccessView('pos') && (
                    <button
                      onClick={() => addToCart(medicine)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      Add to Cart
                    </button>
                  )}
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

  // User Management Functions
  const resetUserForm = () => {
    setUserForm({
      username: '',
      email: '',
      full_name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'cashier',
      permissions: {}
    });
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_new_password: ''
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserManagementLoading(true);
    setUserMessage('');

    if (userForm.password !== userForm.confirmPassword) {
      setUserMessage('Passwords do not match');
      setUserManagementLoading(false);
      return;
    }

    try {
      const userData = {
        username: userForm.username,
        email: userForm.email || null,
        full_name: userForm.full_name || null,
        phone: userForm.phone || null,
        password: userForm.password,
        role: userForm.role,
        permissions: getDefaultPermissions(userForm.role)
      };

      await axios.post(`${API}/users`, userData);
      setShowCreateUser(false);
      resetUserForm();
      fetchUsers();
      setUserMessage('User created successfully');
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Error creating user');
    }
    setUserManagementLoading(false);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setUserManagementLoading(true);
    setUserMessage('');

    try {
      const updateData = {
        username: userForm.username,
        email: userForm.email || null,
        full_name: userForm.full_name || null,
        phone: userForm.phone || null,
        role: userForm.role,
        permissions: getDefaultPermissions(userForm.role),
        is_active: selectedUser.is_active
      };

      await axios.put(`${API}/users/${selectedUser.id}`, updateData);
      setShowEditUser(false);
      setSelectedUser(null);
      resetUserForm();
      fetchUsers();
      setUserMessage('User updated successfully');
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Error updating user');
    }
    setUserManagementLoading(false);
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    setUserManagementLoading(true);
    try {
      await axios.put(`${API}/users/${userId}`, {
        is_active: !currentStatus
      });
      fetchUsers();
      setUserMessage(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Error updating user status');
    }
    setUserManagementLoading(false);
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    setUserManagementLoading(true);
    try {
      await axios.delete(`${API}/users/${userId}`);
      fetchUsers();
      setUserMessage('User deleted successfully');
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Error deleting user');
    }
    setUserManagementLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setUserManagementLoading(true);
    setUserMessage('');

    if (passwordForm.new_password !== passwordForm.confirm_new_password) {
      setUserMessage('New passwords do not match');
      setUserManagementLoading(false);
      return;
    }

    try {
      await axios.put(`${API}/auth/change-password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      setShowChangePassword(false);
      resetPasswordForm();
      setUserMessage('Password changed successfully');
    } catch (error) {
      setUserMessage(error.response?.data?.detail || 'Error changing password');
    }
    setUserManagementLoading(false);
  };

  const getDefaultPermissions = (role) => {
    switch (role) {
      case 'admin':
        return {
          can_manage_users: true,
          can_modify_stock: true,
          can_view_reports: true,
          can_manage_system: true
        };
      case 'manager':
        return {
          can_modify_stock: true,
          can_view_reports: true,
          can_manage_customers: true
        };
      case 'cashier':
        return {
          can_process_sales: true
        };
      default:
        return {};
    }
  };

  const openEditUser = (userToEdit) => {
    setSelectedUser(userToEdit);
    setUserForm({
      username: userToEdit.username,
      email: userToEdit.email || '',
      full_name: userToEdit.full_name || '',
      phone: userToEdit.phone || '',
      password: '',
      confirmPassword: '',
      role: userToEdit.role,
      permissions: userToEdit.permissions || {}
    });
    setShowEditUser(true);
  };

  // Medicine Management Functions
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
        barcode: medicineForm.barcode || null
      };

      await axios.post(`${API}/medicines`, medicineData);
      setShowAddMedicine(false);
      resetMedicineForm();
      fetchMedicines();
      setMedicineMessage('Medicine added successfully');
    } catch (error) {
      setMedicineMessage(error.response?.data?.detail || 'Error adding medicine');
    }
    setMedicineLoading(false);
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
        barcode: medicineForm.barcode || null
      };

      await axios.put(`${API}/medicines/${selectedMedicine.id}`, medicineData);
      setShowEditMedicine(false);
      setSelectedMedicine(null);
      resetMedicineForm();
      fetchMedicines();
      setMedicineMessage('Medicine updated successfully');
    } catch (error) {
      setMedicineMessage(error.response?.data?.detail || 'Error updating medicine');
    }
    setMedicineLoading(false);
  };

  const handleDeleteMedicine = async (medicineId, medicineName) => {
    if (!confirm(`Are you sure you want to delete "${medicineName}"? This action cannot be undone.`)) {
      return;
    }

    setMedicineLoading(true);
    try {
      await axios.delete(`${API}/medicines/${medicineId}`);
      fetchMedicines();
      setMedicineMessage('Medicine deleted successfully');
    } catch (error) {
      setMedicineMessage(error.response?.data?.detail || 'Error deleting medicine');
    }
    setMedicineLoading(false);
  };

  const openEditMedicine = (medicine) => {
    setSelectedMedicine(medicine);
    setMedicineForm({
      name: medicine.name,
      price: medicine.price.toString(),
      stock_quantity: medicine.stock_quantity.toString(),
      expiry_date: new Date(medicine.expiry_date).toISOString().split('T')[0],
      batch_number: medicine.batch_number,
      supplier: medicine.supplier,
      barcode: medicine.barcode || ''
    });
    setShowEditMedicine(true);
  };

  // Check user permissions for medicines
  const canModifyInventory = () => {
    return ['admin', 'manager'].includes(user?.role);
  };

  // Users View with Advanced Management
  const UsersView = () => (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              resetUserForm();
              setShowCreateUser(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Create New User
          </button>
          <button
            onClick={() => setShowChangePassword(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
          >
            Change My Password
          </button>
        </div>
      </div>

      {/* Message Display */}
      {userMessage && (
        <div className={`mb-4 p-4 rounded-lg border ${
          userMessage.includes('successfully') 
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {userMessage}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-800">System Users & Permissions</h3>
          <p className="text-sm text-gray-600 mt-1">Manage user access and roles for the pharmacy system</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((userItem, index) => (
                <tr key={userItem.id} className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        userItem.role === 'admin' ? 'bg-red-500' :
                        userItem.role === 'manager' ? 'bg-blue-500' : 'bg-green-500'
                      }`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{userItem.username}</div>
                        <div className="text-sm text-gray-500">{userItem.full_name || 'No name set'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      {userItem.email && <div className="text-gray-900">{userItem.email}</div>}
                      {userItem.phone && <div className="text-gray-500">{userItem.phone}</div>}
                      {!userItem.email && !userItem.phone && <span className="text-gray-400">No contact info</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      userItem.role === 'admin' ? 'bg-red-100 text-red-800' :
                      userItem.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userItem.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {userItem.is_active ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {userItem.last_login ? new Date(userItem.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditUser(userItem)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(userItem.id, userItem.is_active)}
                        className={`font-medium ${
                          userItem.is_active 
                            ? 'text-red-600 hover:text-red-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                        disabled={userManagementLoading}
                      >
                        {userItem.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {userItem.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                          className="text-red-600 hover:text-red-900 font-medium"
                          disabled={userManagementLoading}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Create New User</h3>
                <button 
                  onClick={() => setShowCreateUser(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    required
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={userForm.password}
                    onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm({...userForm, confirmPassword: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm password"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateUser(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userManagementLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {userManagementLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit User: {selectedUser.username}</h3>
                <button 
                  onClick={() => {setShowEditUser(false); setSelectedUser(null);}}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({...userForm, full_name: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    required
                    value={userForm.role}
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {setShowEditUser(false); setSelectedUser(null);}}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userManagementLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {userManagementLoading ? 'Updating...' : 'Update User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Change Password</h3>
                <button 
                  onClick={() => setShowChangePassword(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirm_new_password}
                    onChange={(e) => setPasswordForm({...passwordForm, confirm_new_password: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userManagementLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {userManagementLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Role Descriptions */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <h4 className="font-semibold text-red-700">Admin</h4>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Full system access</li>
            <li>• User management</li>
            <li>• Stock modification</li>
            <li>• All reports access</li>
            <li>• System configuration</li>
          </ul>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <h4 className="font-semibold text-blue-700">Manager</h4>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• POS operations</li>
            <li>• Stock modification</li>
            <li>• Sales reports</li>
            <li>• Inventory management</li>
            <li>• Customer management</li>
          </ul>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <h4 className="font-semibold text-green-700">Cashier</h4>
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• POS operations only</li>
            <li>• Process sales</li>
            <li>• View inventory</li>
            <li>• Basic customer service</li>
            <li>• No system changes</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      
      {canAccessView(currentView) ? (
        <>
          {currentView === 'pos' && <POSView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'sales' && <SalesView />}
          {currentView === 'users' && <UsersView />}
        </>
      ) : (
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this section.</p>
        </div>
      )}
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
};

// Component to handle authentication state
const AuthenticatedApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <MainApp /> : <LoginScreen />;
};

export default App;