import React, { createContext, useContext, useState, useEffect } from 'react';
import offlineStorage from '../utils/offlineStorage';
import apiService from '../services/api';

const OfflineAuthContext = createContext();

export const OfflineAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = offlineStorage.getCurrentUser();
        if (currentUser) {
          setUser({
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            full_name: currentUser.full_name,
            role: currentUser.role,
            permissions: currentUser.permissions,
            lastLogin: currentUser.lastLogin
          });
          setIsAuthenticated(true);
        } else {
          // Auto-login admin user for Telegram testing
          console.log('No user found, attempting auto-login...');
          const result = offlineStorage.authenticate('admin', 'admin123', false);
          if (result.success) {
            setUser(result.user);
            setIsAuthenticated(true);
            console.log('Auto-login successful');
          } else {
            setUser(null);
            setIsAuthenticated(false);
            console.log('Auto-login failed');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password, rememberMe = false) => {
    try {
      const result = offlineStorage.authenticate(username, password, rememberMe);
      
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed due to system error' };
    }
  };

  const logout = () => {
    try {
      offlineStorage.logout();
      setUser(null);
      setIsAuthenticated(false);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  };

  // RMS Data Management Methods - Updated to use API
  const getMedicines = async (searchTerm = '') => {
    try {
      // Try API first, fallback to offline storage
      const medicines = await apiService.getMedicines(searchTerm);
      return medicines;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.getMedicines(searchTerm);
    }
  };

  const addMedicine = async (medicineData) => {
    try {
      // Try API first, fallback to offline storage
      const medicine = await apiService.createMedicine(medicineData);
      // Also save to offline storage for backup
      offlineStorage.addMedicine(medicine);
      return medicine;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.addMedicine(medicineData);
    }
  };

  const updateMedicine = async (medicineId, medicineData) => {
    try {
      // Try API first, fallback to offline storage
      const medicine = await apiService.updateMedicine(medicineId, medicineData);
      // Also update offline storage for backup
      offlineStorage.updateMedicine(medicineId, medicine);
      return medicine;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.updateMedicine(medicineId, medicineData);
    }
  };

  const deleteMedicine = async (medicineId) => {
    try {
      // Try API first, fallback to offline storage
      const result = await apiService.deleteMedicine(medicineId);
      // Also delete from offline storage
      offlineStorage.deleteMedicine(medicineId);
      return result.success;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.deleteMedicine(medicineId);
    }
  };

  const getSales = async () => {
    try {
      // Try API first, fallback to offline storage
      const sales = await apiService.getSales();
      return sales;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.getSales();
    }
  };

  const addSale = async (saleData) => {
    try {
      // Try API first, fallback to offline storage
      const sale = await apiService.createSale(saleData);
      // Also save to offline storage for backup
      offlineStorage.addSale(sale);
      return sale;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.addSale(saleData);
    }
  };

  const getSaleById = async (saleId) => {
    try {
      // Try API first, fallback to offline storage
      const sale = await apiService.getSale(saleId);
      return sale;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.getSaleById(saleId);
    }
  };

  const updateSale = async (saleId, updatedSaleData) => {
    try {
      // Try API first, fallback to offline storage
      const sale = await apiService.updateSale(saleId, updatedSaleData);
      // Also update offline storage for backup
      offlineStorage.updateSale(saleId, sale);
      return sale;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.updateSale(saleId, updatedSaleData);
    }
  };

  const deleteSale = async (saleId) => {
    try {
      // Try API first, fallback to offline storage
      const result = await apiService.deleteSale(saleId);
      // Also delete from offline storage
      offlineStorage.deleteSale(saleId);
      return result.success;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.deleteSale(saleId);
    }
  };

  const getSalesAnalytics = async () => {
    try {
      // Try API first, fallback to offline storage
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const analytics = await apiService.getSalesAnalytics(
        thirtyDaysAgo.toISOString(),
        today.toISOString()
      );
      return analytics;
    } catch (error) {
      console.error('API error, falling back to offline storage:', error);
      return offlineStorage.getSalesAnalytics();
    }
  };

  const getShop = async () => {
    try {
      const shop = await apiService.getShop();
      return shop;
    } catch (error) {
      console.error('Get shop API error, falling back to offline storage:', error);
      return offlineStorage.getShop();
    }
  };

  const updateShop = async (shopData) => {
    try {
      const updatedShop = await apiService.updateShop(shopData);
      // Also update local storage for offline access
      offlineStorage.updateShop(updatedShop);
      return updatedShop;
    } catch (error) {
      console.error('Update shop API error, falling back to offline storage:', error);
      return offlineStorage.updateShop(shopData);
    }
  };

  // User Management (admin only)
  const getAllUsers = () => {
    try {
      if (user?.role !== 'admin') {
        return { success: false, error: 'Insufficient permissions' };
      }
      const users = offlineStorage.getUsers();
      return { success: true, users };
    } catch (error) {
      console.error('Get users error:', error);
      return { success: false, error: 'Failed to fetch users' };
    }
  };

  const createUser = (userData) => {
    try {
      if (user?.role !== 'admin') {
        return { success: false, error: 'Insufficient permissions' };
      }
      const newUser = offlineStorage.addUser(userData);
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: 'Failed to create user' };
    }
  };

  const updateUser = (userId, userData) => {
    try {
      if (user?.role !== 'admin') {
        return { success: false, error: 'Insufficient permissions' };
      }
      const updatedUser = offlineStorage.updateUser(userId, userData);
      return updatedUser ? { success: true, user: updatedUser } : { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'Failed to update user' };
    }
  };

  const deleteUser = (userId) => {
    try {
      if (user?.role !== 'admin') {
        return { success: false, error: 'Insufficient permissions' };
      }
      if (userId === user.id) {
        return { success: false, error: 'Cannot delete your own account' };
      }
      offlineStorage.deleteUser(userId);
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  };

  const updateUserProfile = (userData) => {
    try {
      const updatedUser = offlineStorage.updateUser(user.id, userData);
      if (updatedUser) {
        setUser({
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          full_name: updatedUser.full_name,
          role: updatedUser.role,
          permissions: updatedUser.permissions
        });
        return { success: true };
      }
      return { success: false, error: 'Failed to update profile' };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: 'Profile update failed' };
    }
  };

  const changePassword = (currentPassword, newPassword) => {
    try {
      const result = offlineStorage.changePassword(user.id, currentPassword, newPassword);
      return result;
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, error: 'Password change failed' };
    }
  };

  // Data management
  const exportData = () => {
    try {
      return offlineStorage.exportData();
    } catch (error) {
      console.error('Export data error:', error);
      return null;
    }
  };

  const importData = (data) => {
    try {
      return offlineStorage.importData(data);
    } catch (error) {
      console.error('Import data error:', error);
      return false;
    }
  };

  const clearAllData = () => {
    try {
      offlineStorage.clearAllData();
      logout();
      return true;
    } catch (error) {
      console.error('Clear data error:', error);
      return false;
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated,
    
    // RMS Data Management
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
    
    // User Management
    updateUserProfile,
    changePassword,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    
    // Data Management
    exportData,
    importData,
    clearAllData
  };

  return (
    <OfflineAuthContext.Provider value={value}>
      {children}
    </OfflineAuthContext.Provider>
  );
};

export const useOfflineAuth = () => {
  const context = useContext(OfflineAuthContext);
  if (!context) {
    throw new Error('useOfflineAuth must be used within an OfflineAuthProvider');
  }
  return context;
};