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

  const addMedicine = async (medicineData) => {
    try {
      // Always save to localStorage first (offline capability)
      const localMedicine = offlineStorage.addMedicine(medicineData);
      
      // Try to sync with backend API
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/medicines`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: localMedicine.id,
            name: localMedicine.name,
            price: localMedicine.price,
            stock_quantity: localMedicine.stock_quantity,
            expiry_date: localMedicine.expiry_date,
            batch_number: localMedicine.batch_number,
            supplier: localMedicine.supplier,
            barcode: localMedicine.barcode,
            created_at: localMedicine.created_at,
            updated_at: localMedicine.updated_at
          })
        });
        
        if (response.ok) {
          console.log('Medicine synced with backend successfully');
        } else {
          console.warn('Failed to sync medicine with backend, will retry later');
        }
      } catch (apiError) {
        console.warn('Backend API not available, medicine stored offline only:', apiError.message);
      }
      
      return localMedicine;
    } catch (error) {
      console.error('Add medicine error:', error);
      return null;
    }
  };

  const updateMedicine = async (medicineId, medicineData) => {
    try {
      // Always update in localStorage first (offline capability)
      const updatedMedicine = offlineStorage.updateMedicine(medicineId, medicineData);
      
      // Try to sync with backend API
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/medicines/${medicineId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...medicineData,
            updated_at: new Date().toISOString()
          })
        });
        
        if (response.ok) {
          console.log('Medicine update synced with backend successfully');
        } else {
          console.warn('Failed to sync medicine update with backend, will retry later');
        }
      } catch (apiError) {
        console.warn('Backend API not available, medicine updated offline only:', apiError.message);
      }
      
      return updatedMedicine;
    } catch (error) {
      console.error('Update medicine error:', error);
      return null;
    }
  };

  const deleteMedicine = async (medicineId) => {
    try {
      // Always delete from localStorage first (offline capability)
      const success = offlineStorage.deleteMedicine(medicineId);
      
      // Try to sync with backend API
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/medicines/${medicineId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          console.log('Medicine deletion synced with backend successfully');
        } else {
          console.warn('Failed to sync medicine deletion with backend, will retry later');
        }
      } catch (apiError) {
        console.warn('Backend API not available, medicine deleted offline only:', apiError.message);
      }
      
      return success;
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

  // Function to sync existing localStorage data with backend
  const syncLocalDataWithBackend = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      // First, get existing sales from backend to avoid duplicates
      const existingSalesResponse = await fetch(`${backendUrl}/api/sales`);
      const existingSalesData = existingSalesResponse.ok ? await existingSalesResponse.json() : { sales: [] };
      const existingSalesIds = new Set(existingSalesData.sales.map(sale => sale.id));
      
      // Get local sales that need to be synced
      const localSales = offlineStorage.getSales();
      const salesToSync = localSales.filter(sale => !existingSalesIds.has(sale.id));
      
      console.log(`Syncing ${salesToSync.length} local sales with backend...`);
      
      // Sync sales
      for (const sale of salesToSync) {
        try {
          const response = await fetch(`${backendUrl}/api/sales`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: sale.id,
              receipt_number: sale.receipt_number,
              items: sale.items,
              total_amount: sale.total_amount,
              subtotal_amount: sale.subtotal_amount,
              discount_type: sale.discount_type,
              discount_value: sale.discount_value,
              discount_amount: sale.discount_amount,
              payment_method: sale.payment_method,
              customer_name: sale.customer_name,
              customer_phone: sale.customer_phone,
              cashier_id: sale.cashier_id,
              is_return: sale.is_return,
              created_at: sale.sale_date
            })
          });
          
          if (response.ok) {
            console.log(`Synced sale ${sale.receipt_number} successfully`);
          }
        } catch (error) {
          console.warn(`Failed to sync sale ${sale.receipt_number}:`, error.message);
        }
      }
      
      // Now sync medicines - get backend medicines first
      const existingMedicinesResponse = await fetch(`${backendUrl}/api/medicines`);
      const existingMedicinesData = existingMedicinesResponse.ok ? await existingMedicinesResponse.json() : { medicines: [] };
      const existingMedicineIds = new Set(existingMedicinesData.medicines.map(med => med.id));
      
      // Get local medicines that need to be synced
      const localMedicines = offlineStorage.getMedicines();
      const medicinesToSync = localMedicines.filter(medicine => !existingMedicineIds.has(medicine.id));
      
      console.log(`Syncing ${medicinesToSync.length} local medicines with backend...`);
      
      // Sync new medicines
      for (const medicine of medicinesToSync) {
        try {
          const response = await fetch(`${backendUrl}/api/medicines`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(medicine)
          });
          
          if (response.ok) {
            console.log(`Synced medicine ${medicine.name} successfully`);
          }
        } catch (error) {
          console.warn(`Failed to sync medicine ${medicine.name}:`, error.message);
        }
      }
      
      // Update stock for existing medicines that might have stock differences
      for (const localMedicine of localMedicines) {
        if (existingMedicineIds.has(localMedicine.id)) {
          const existingMedicine = existingMedicinesData.medicines.find(m => m.id === localMedicine.id);
          if (existingMedicine && existingMedicine.stock_quantity !== localMedicine.stock_quantity) {
            try {
              await fetch(`${backendUrl}/api/medicines/${localMedicine.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  stock_quantity: localMedicine.stock_quantity,
                  updated_at: new Date().toISOString()
                })
              });
              console.log(`Updated stock for medicine ${localMedicine.name}`);
            } catch (error) {
              console.warn(`Failed to update stock for medicine ${localMedicine.name}:`, error.message);
            }
          }
        }
      }
      
      console.log('Data sync completed');
      return true;
    } catch (error) {
      console.warn('Backend sync not available:', error.message);
      return false;
    }
  };

  // Helper function to sync medicine stock with backend
  const syncMedicineStockWithBackend = async (items) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      // Get current medicines from localStorage to get updated stock
      const localMedicines = offlineStorage.getMedicines();
      
      for (const item of items) {
        const localMedicine = localMedicines.find(m => m.id === item.medicine_id);
        if (localMedicine) {
          try {
            await fetch(`${backendUrl}/api/medicines/${item.medicine_id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                stock_quantity: localMedicine.stock_quantity,
                updated_at: new Date().toISOString()
              })
            });
          } catch (medicineUpdateError) {
            console.warn(`Failed to sync stock for medicine ${item.medicine_id}:`, medicineUpdateError.message);
          }
        }
      }
    } catch (error) {
      console.warn('Error syncing medicine stock with backend:', error.message);
    }
  };

  const addSale = async (saleData) => {
    try {
      // Always save to localStorage first (offline capability)
      const localSale = offlineStorage.addSale(saleData);
      
      // Try to sync with backend API
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/sales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: localSale.id,
            receipt_number: localSale.receipt_number,
            items: localSale.items,
            total_amount: localSale.total_amount,
            subtotal_amount: localSale.subtotal_amount,
            discount_type: localSale.discount_type,
            discount_value: localSale.discount_value,
            discount_amount: localSale.discount_amount,
            payment_method: localSale.payment_method,
            customer_name: localSale.customer_name,
            customer_phone: localSale.customer_phone,
            cashier_id: localSale.cashier_id,
            is_return: localSale.is_return,
            created_at: localSale.sale_date
          })
        });
        
        if (response.ok) {
          console.log('Sale synced with backend successfully');
          // Also sync medicine stock updates
          await syncMedicineStockWithBackend(saleData.items);
        } else {
          console.warn('Failed to sync sale with backend, will retry later');
        }
      } catch (apiError) {
        console.warn('Backend API not available, sale stored offline only:', apiError.message);
      }
      
      return localSale;
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

  // Backup and Restore Functions
  const getBackupList = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/list`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch backups: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Get backup list error:', error);
      return { backups: [] };
    }
  };

  const createBackup = async (backupOptions) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupOptions),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create backup: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Create backup error:', error);
      throw error;
    }
  };

  const restoreBackup = async (restoreOptions) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(restoreOptions),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to restore backup: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Restore backup error:', error);
      throw error;
    }
  };

  const deleteBackup = async (backupId) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/${backupId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete backup: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Delete backup error:', error);
      return { success: false, error: error.message };
    }
  };

  const downloadBackup = async (backupId, backupName) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/download/${backupId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to download backup: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${backupName || 'backup'}.json`;
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
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${backendUrl}/api/backup/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload backup: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Upload backup error:', error);
      return { success: false, error: error.message };
    }
  };

  const getBackupPreview = async (backupId) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/backup/preview/${backupId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get backup preview: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Get backup preview error:', error);
      return null;
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
    
    // Data sync
    syncLocalDataWithBackend,
    
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
    clearAllData,
    
    // Backup and Restore
    getBackupList,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    uploadBackupFile,
    getBackupPreview
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