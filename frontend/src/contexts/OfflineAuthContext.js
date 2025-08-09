import React, { createContext, useContext, useState, useEffect } from 'react';
import offlineStorage from '../utils/offlineStorage';

const OfflineAuthContext = createContext();

export const OfflineAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = () => {
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
          setUser(null);
          setIsAuthenticated(false);
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

  // RMS Data Management Methods
  const getMedicines = (searchTerm = '') => {
    try {
      return offlineStorage.getMedicines(searchTerm);
    } catch (error) {
      console.error('Get medicines error:', error);
      return [];
    }
  };

  const addMedicine = (medicineData) => {
    try {
      return offlineStorage.addMedicine(medicineData);
    } catch (error) {
      console.error('Add medicine error:', error);
      return null;
    }
  };

  const updateMedicine = (medicineId, medicineData) => {
    try {
      return offlineStorage.updateMedicine(medicineId, medicineData);
    } catch (error) {
      console.error('Update medicine error:', error);
      return null;
    }
  };

  const deleteMedicine = (medicineId) => {
    try {
      return offlineStorage.deleteMedicine(medicineId);
    } catch (error) {
      console.error('Delete medicine error:', error);
      return false;
    }
  };

  const getSales = () => {
    try {
      return offlineStorage.getSales();
    } catch (error) {
      console.error('Get sales error:', error);
      return [];
    }
  };

  const addSale = (saleData) => {
    try {
      return offlineStorage.addSale(saleData);
    } catch (error) {
      console.error('Add sale error:', error);
      return null;
    }
  };

  const getSaleById = (saleId) => {
    try {
      return offlineStorage.getSaleById(saleId);
    } catch (error) {
      console.error('Get sale by ID error:', error);
      return null;
    }
  };

  const updateSale = (saleId, updatedSaleData) => {
    try {
      return offlineStorage.updateSale(saleId, updatedSaleData);
    } catch (error) {
      console.error('Update sale error:', error);
      return null;
    }
  };

  const deleteSale = (saleId) => {
    try {
      return offlineStorage.deleteSale(saleId);
    } catch (error) {
      console.error('Delete sale error:', error);
      return false;
    }
  };

  const getSalesAnalytics = () => {
    try {
      return offlineStorage.getSalesAnalytics();
    } catch (error) {
      console.error('Get analytics error:', error);
      return { total_sales: 0, total_transactions: 0, avg_transaction: 0 };
    }
  };

  const getShop = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/shop`);
      if (response.ok) {
        const shopData = await response.json();
        return shopData;
      } else {
        console.error('Failed to fetch shop data from API');
        // Fallback to local storage
        return offlineStorage.getShop();
      }
    } catch (error) {
      console.error('Get shop API error:', error);
      // Fallback to local storage
      return offlineStorage.getShop();
    }
  };

  const updateShop = async (shopData) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/shop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopData)
      });
      
      if (response.ok) {
        const updatedShop = await response.json();
        // Also update local storage for offline access
        offlineStorage.updateShop(updatedShop);
        return updatedShop;
      } else {
        console.error('Failed to update shop via API');
        // Fallback to local storage
        return offlineStorage.updateShop(shopData);
      }
    } catch (error) {
      console.error('Update shop API error:', error);
      // Fallback to local storage
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