// Offline Storage Utilities for Local Authentication - RMS Integration
class OfflineStorage {
  constructor() {
    this.USERS_KEY = 'offline_users';
    this.AUTH_KEY = 'offline_auth';
    this.SESSIONS_KEY = 'offline_sessions';
    this.MEDICINES_KEY = 'offline_medicines';
    this.SALES_KEY = 'offline_sales';
    this.SHOP_KEY = 'offline_shop';
    this.RETURNS_KEY = 'offline_returns'; // NEW: For tracking returns
    this.init();
  }

  init() {
    // Initialize with default users if not exists
    if (!localStorage.getItem(this.USERS_KEY)) {
      this.createDefaultUsers();
    }
    if (!localStorage.getItem(this.MEDICINES_KEY)) {
      this.createDefaultMedicines();
    }
    if (!localStorage.getItem(this.SHOP_KEY)) {
      this.createDefaultShop();
    }
  }

  createDefaultUsers() {
    const defaultUsers = [
      {
        id: 'admin-001',
        username: 'admin',
        email: 'admin@medipos.local',
        full_name: 'System Administrator',
        phone: '+1234567890',
        role: 'admin',
        password: 'admin123', // In real app, this would be hashed
        isActive: true,
        permissions: {
          canManageUsers: true,
          canModifyStock: true,
          canViewReports: true,
          canManageSystem: true
        },
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: 'manager-001',
        username: 'manager',
        email: 'manager@medipos.local',
        full_name: 'Store Manager',
        phone: '+1234567891',
        role: 'manager',
        password: 'manager123',
        isActive: true,
        permissions: {
          canManageUsers: false,
          canModifyStock: true,
          canViewReports: true,
          canManageSystem: false
        },
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: 'cashier-001',
        username: 'cashier',
        email: 'cashier@medipos.local',
        full_name: 'Store Cashier',
        phone: '+1234567892',
        role: 'cashier',
        password: 'cashier123',
        isActive: true,
        permissions: {
          canManageUsers: false,
          canModifyStock: false,
          canViewReports: false,
          canManageSystem: false
        },
        createdAt: new Date().toISOString(),
        lastLogin: null
      }
    ];

    localStorage.setItem(this.USERS_KEY, JSON.stringify(defaultUsers));
  }

  createDefaultMedicines() {
    const defaultMedicines = [
      {
        id: 'med-001',
        name: 'Paracetamol 500mg',
        price: 2.50,
        stock_quantity: 100,
        expiry_date: '2025-12-31',
        batch_number: 'PCM001',
        supplier: 'PharmaCorp Ltd',
        barcode: '1234567890123',
        created_at: new Date().toISOString()
      },
      {
        id: 'med-002',
        name: 'Amoxicillin 250mg',
        price: 8.75,
        stock_quantity: 75,
        expiry_date: '2025-08-15',
        batch_number: 'AMX002',
        supplier: 'MedSupply Co',
        barcode: '1234567890124',
        created_at: new Date().toISOString()
      },
      {
        id: 'med-003',
        name: 'Ibuprofen 400mg',
        price: 5.25,
        stock_quantity: 50,
        expiry_date: '2025-10-20',
        batch_number: 'IBU003',
        supplier: 'HealthMeds Inc',
        barcode: '1234567890125',
        created_at: new Date().toISOString()
      },
      {
        id: 'med-004',
        name: 'Aspirin 325mg',
        price: 3.00,
        stock_quantity: 8,
        expiry_date: '2025-06-30',
        batch_number: 'ASP004',
        supplier: 'PharmaCorp Ltd',
        barcode: '1234567890126',
        created_at: new Date().toISOString()
      },
      {
        id: 'med-005',
        name: 'Omeprazole 20mg',
        price: 12.50,
        stock_quantity: 30,
        expiry_date: '2026-03-15',
        batch_number: 'OME005',
        supplier: 'MedSupply Co',
        barcode: '1234567890127',
        created_at: new Date().toISOString()
      }
    ];

    localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(defaultMedicines));
  }

  createDefaultShop() {
    const shopDetails = {
      id: 'shop-001',
      name: 'MediPOS Pharmacy',
      address: '123 Health Street, Medical District, City 12345',
      phone: '+1-555-MEDIPOS',
      email: 'info@medipos.local',
      license_number: 'PH-2024-001',
      gst_number: 'GST123456789',
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(this.SHOP_KEY, JSON.stringify(shopDetails));
  }

  // User Management (existing methods)
  getUsers() {
    const users = localStorage.getItem(this.USERS_KEY);
    return users ? JSON.parse(users) : [];
  }

  getUserByUsername(username) {
    const users = this.getUsers();
    return users.find(user => user.username === username);
  }

  getUserById(id) {
    const users = this.getUsers();
    return users.find(user => user.id === id);
  }

  updateUser(userId, userData) {
    const users = this.getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...userData, updatedAt: new Date().toISOString() };
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
      return users[userIndex];
    }
    return null;
  }

  addUser(userData) {
    const users = this.getUsers();
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    return newUser;
  }

  deleteUser(userId) {
    const users = this.getUsers();
    const filteredUsers = users.filter(user => user.id !== userId);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(filteredUsers));
    return true;
  }

  // Medicine Management
  getMedicines(searchTerm = '') {
    const medicines = localStorage.getItem(this.MEDICINES_KEY);
    const parsedMedicines = medicines ? JSON.parse(medicines) : [];
    
    if (!searchTerm) {
      return parsedMedicines;
    }

    return parsedMedicines.filter(medicine =>
      medicine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      medicine.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  getMedicineById(id) {
    const medicines = this.getMedicines();
    return medicines.find(medicine => medicine.id === id);
  }

  addMedicine(medicineData) {
    const medicines = this.getMedicines();
    const newMedicine = {
      id: `med-${Date.now()}`,
      ...medicineData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    medicines.push(newMedicine);
    localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(medicines));
    return newMedicine;
  }

  updateMedicine(medicineId, medicineData) {
    const medicines = this.getMedicines();
    const medicineIndex = medicines.findIndex(medicine => medicine.id === medicineId);
    if (medicineIndex !== -1) {
      medicines[medicineIndex] = { 
        ...medicines[medicineIndex], 
        ...medicineData, 
        updated_at: new Date().toISOString() 
      };
      localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(medicines));
      return medicines[medicineIndex];
    }
    return null;
  }

  deleteMedicine(medicineId) {
    const medicines = this.getMedicines();
    const filteredMedicines = medicines.filter(medicine => medicine.id !== medicineId);
    localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(filteredMedicines));
    return true;
  }

  updateMedicineStock(medicineId, newQuantity) {
    const medicines = this.getMedicines();
    const medicineIndex = medicines.findIndex(medicine => medicine.id === medicineId);
    if (medicineIndex !== -1) {
      medicines[medicineIndex].stock_quantity = newQuantity;
      medicines[medicineIndex].updated_at = new Date().toISOString();
      localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(medicines));
      return medicines[medicineIndex];
    }
    return null;
  }

  // Sales Management - Enhanced with discount and return support
  getSales() {
    const sales = localStorage.getItem(this.SALES_KEY);
    return sales ? JSON.parse(sales) : [];
  }

  addSale(saleData) {
    const sales = this.getSales();
    const newSale = {
      id: `sale-${Date.now()}`,
      receipt_number: `RCP${Date.now()}`,
      ...saleData,
      sale_date: new Date().toISOString()
    };
    sales.push(newSale);
    localStorage.setItem(this.SALES_KEY, JSON.stringify(sales));

    // Update medicine stock quantities
    saleData.items.forEach(item => {
      const medicine = this.getMedicineById(item.medicine_id);
      if (medicine) {
        if (item.is_return) {
          // Returns increase stock
          const newStock = medicine.stock_quantity + item.quantity;
          this.updateMedicineStock(item.medicine_id, newStock);
        } else {
          // Sales decrease stock
          const newStock = medicine.stock_quantity - item.quantity;
          this.updateMedicineStock(item.medicine_id, newStock);
        }
      }
    });

    return newSale;
  }

  getSaleById(saleId) {
    const sales = this.getSales();
    return sales.find(sale => sale.id === saleId);
  }

  updateSale(saleId, updatedSaleData) {
    const sales = this.getSales();
    const saleIndex = sales.findIndex(sale => sale.id === saleId);
    
    if (saleIndex === -1) {
      return null;
    }

    const originalSale = sales[saleIndex];
    
    // Restore stock from original sale items
    originalSale.items.forEach(item => {
      const medicine = this.getMedicineById(item.medicine_id);
      if (medicine) {
        if (item.is_return) {
          // Original return - decrease stock back
          const restoredStock = medicine.stock_quantity - item.quantity;
          this.updateMedicineStock(item.medicine_id, restoredStock);
        } else {
          // Original sale - increase stock back
          const restoredStock = medicine.stock_quantity + item.quantity;
          this.updateMedicineStock(item.medicine_id, restoredStock);
        }
      }
    });

    // Update the sale
    const updatedSale = {
      ...originalSale,
      ...updatedSaleData,
      updated_at: new Date().toISOString()
    };
    sales[saleIndex] = updatedSale;
    localStorage.setItem(this.SALES_KEY, JSON.stringify(sales));

    // Apply stock changes for updated sale items
    updatedSale.items.forEach(item => {
      const medicine = this.getMedicineById(item.medicine_id);
      if (medicine) {
        if (item.is_return) {
          // New return - increase stock
          const newStock = medicine.stock_quantity + item.quantity;
          this.updateMedicineStock(item.medicine_id, newStock);
        } else {
          // New sale - decrease stock
          const newStock = medicine.stock_quantity - item.quantity;
          this.updateMedicineStock(item.medicine_id, newStock);
        }
      }
    });

    return updatedSale;
  }

  deleteSale(saleId) {
    const sales = this.getSales();
    const saleIndex = sales.findIndex(sale => sale.id === saleId);
    
    if (saleIndex === -1) {
      return false;
    }

    const saleToDelete = sales[saleIndex];
    
    // Restore stock from deleted sale items
    saleToDelete.items.forEach(item => {
      const medicine = this.getMedicineById(item.medicine_id);
      if (medicine) {
        if (item.is_return) {
          // Deleting return - decrease stock
          const restoredStock = medicine.stock_quantity - item.quantity;
          this.updateMedicineStock(item.medicine_id, restoredStock);
        } else {
          // Deleting sale - increase stock
          const restoredStock = medicine.stock_quantity + item.quantity;
          this.updateMedicineStock(item.medicine_id, restoredStock);
        }
      }
    });

    // Remove the sale
    const updatedSales = sales.filter(sale => sale.id !== saleId);
    localStorage.setItem(this.SALES_KEY, JSON.stringify(updatedSales));
    
    return true;
  }

  getSalesAnalytics() {
    const sales = this.getSales();
    
    if (sales.length === 0) {
      return {
        total_sales: 0,
        total_transactions: 0,
        avg_transaction: 0,
        total_returns: 0,
        total_discounts: 0
      };
    }

    let totalSales = 0;
    let totalReturns = 0;
    let totalDiscounts = 0;
    let salesTransactions = 0;
    let returnTransactions = 0;

    sales.forEach(sale => {
      if (sale.is_return || sale.items?.some(item => item.is_return)) {
        totalReturns += Math.abs(sale.total_amount);
        returnTransactions++;
      } else {
        totalSales += sale.total_amount;
        salesTransactions++;
      }
      
      if (sale.discount_amount) {
        totalDiscounts += sale.discount_amount;
      }
    });

    const totalTransactions = salesTransactions + returnTransactions;
    const netSales = totalSales - totalReturns;
    const avgTransaction = totalTransactions > 0 ? netSales / totalTransactions : 0;

    return {
      total_sales: parseFloat(totalSales.toFixed(2)),
      total_returns: parseFloat(totalReturns.toFixed(2)),
      net_sales: parseFloat(netSales.toFixed(2)),
      total_discounts: parseFloat(totalDiscounts.toFixed(2)),
      total_transactions: totalTransactions,
      sales_transactions: salesTransactions,
      return_transactions: returnTransactions,
      avg_transaction: parseFloat(avgTransaction.toFixed(2))
    };
  }

  // Shop Management
  getShop() {
    const shop = localStorage.getItem(this.SHOP_KEY);
    return shop ? JSON.parse(shop) : null;
  }

  updateShop(shopData) {
    const existingShop = this.getShop();
    const updatedShop = {
      ...existingShop,
      ...shopData,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(this.SHOP_KEY, JSON.stringify(updatedShop));
    return updatedShop;
  }

  // Authentication (existing methods)
  authenticate(username, password, rememberMe = false) {
    const user = this.getUserByUsername(username);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated' };
    }

    // Simple password check (in real app, would compare hashed passwords)
    if (user.password !== password) {
      return { success: false, error: 'Invalid password' };
    }

    // Update last login
    this.updateUser(user.id, { lastLogin: new Date().toISOString() });

    // Create session
    const session = this.createSession(user, rememberMe);
    
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions
      },
      session
    };
  }

  createSession(user, rememberMe) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
    } else {
      expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours
    }

    const session = {
      sessionId,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      rememberMe
    };

    // Store current session
    localStorage.setItem(this.AUTH_KEY, JSON.stringify(session));
    
    // Store in sessions history
    const sessions = this.getSessions();
    sessions.push(session);
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));

    return session;
  }

  getCurrentSession() {
    const session = localStorage.getItem(this.AUTH_KEY);
    if (!session) return null;

    const sessionData = JSON.parse(session);
    const now = new Date();
    const expiresAt = new Date(sessionData.expiresAt);

    if (now > expiresAt) {
      this.logout();
      return null;
    }

    return sessionData;
  }

  getCurrentUser() {
    const session = this.getCurrentSession();
    if (!session) return null;

    return this.getUserById(session.userId);
  }

  getSessions() {
    const sessions = localStorage.getItem(this.SESSIONS_KEY);
    return sessions ? JSON.parse(sessions) : [];
  }

  logout() {
    localStorage.removeItem(this.AUTH_KEY);
    return true;
  }

  isAuthenticated() {
    return this.getCurrentSession() !== null;
  }

  // Password management
  changePassword(userId, currentPassword, newPassword) {
    const user = this.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.password !== currentPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    this.updateUser(userId, { password: newPassword });
    return { success: true, message: 'Password changed successfully' };
  }

  // Data export/import for synchronization
  exportData() {
    return {
      users: this.getUsers(),
      medicines: this.getMedicines(),
      sales: this.getSales(),
      shop: this.getShop(),
      sessions: this.getSessions(),
      exportedAt: new Date().toISOString()
    };
  }

  importData(data) {
    if (data.users) {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(data.users));
    }
    if (data.medicines) {
      localStorage.setItem(this.MEDICINES_KEY, JSON.stringify(data.medicines));
    }
    if (data.sales) {
      localStorage.setItem(this.SALES_KEY, JSON.stringify(data.sales));
    }
    if (data.shop) {
      localStorage.setItem(this.SHOP_KEY, JSON.stringify(data.shop));
    }
    if (data.sessions) {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(data.sessions));
    }
    return true;
  }

  // Clear all data
  clearAllData() {
    localStorage.removeItem(this.USERS_KEY);
    localStorage.removeItem(this.AUTH_KEY);
    localStorage.removeItem(this.SESSIONS_KEY);
    localStorage.removeItem(this.MEDICINES_KEY);
    localStorage.removeItem(this.SALES_KEY);
    localStorage.removeItem(this.SHOP_KEY);
    this.init(); // Reinitialize with defaults
  }
}

export default new OfflineStorage();