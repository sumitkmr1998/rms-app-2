// API service for backend communication
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL + '/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Medicine Management
  async getMedicines(search = '') {
    const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await this.request(`/medicines${searchParam}`);
    return response.medicines || [];
  }

  async getMedicine(medicineId) {
    return await this.request(`/medicines/${medicineId}`);
  }

  async createMedicine(medicineData) {
    return await this.request('/medicines', {
      method: 'POST',
      body: JSON.stringify(medicineData),
    });
  }

  async updateMedicine(medicineId, medicineData) {
    return await this.request(`/medicines/${medicineId}`, {
      method: 'PUT',
      body: JSON.stringify(medicineData),
    });
  }

  async deleteMedicine(medicineId) {
    return await this.request(`/medicines/${medicineId}`, {
      method: 'DELETE',
    });
  }

  // Sales Management
  async getSales(limit = 100, skip = 0) {
    const response = await this.request(`/sales?limit=${limit}&skip=${skip}`);
    return response.sales || [];
  }

  async getSale(saleId) {
    return await this.request(`/sales/${saleId}`);
  }

  async createSale(saleData) {
    return await this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async updateSale(saleId, saleData) {
    return await this.request(`/sales/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify(saleData),
    });
  }

  async deleteSale(saleId) {
    return await this.request(`/sales/${saleId}`, {
      method: 'DELETE',
    });
  }

  // Analytics
  async getSalesAnalytics(startDate, endDate) {
    return await this.request('/analytics/sales', {
      method: 'POST',
      body: JSON.stringify({
        start_date: startDate,
        end_date: endDate,
      }),
    });
  }

  async getMedicineSalesHistory(medicineId, days = 30) {
    return await this.request(`/analytics/medicine-sales/${medicineId}?days=${days}`);
  }

  // Shop Management
  async getShop() {
    return await this.request('/shop');
  }

  async updateShop(shopData) {
    return await this.request('/shop', {
      method: 'PUT',
      body: JSON.stringify(shopData),
    });
  }

  // Notification Management
  async getTelegramSettings() {
    return await this.request('/telegram/settings');
  }

  async updateTelegramSettings(settings) {
    return await this.request('/telegram/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testTelegramConnection(botToken, chatId, message) {
    return await this.request('/telegram/test', {
      method: 'POST',
      body: JSON.stringify({
        bot_token: botToken,
        chat_id: chatId,
        message,
      }),
    });
  }

  async checkLowStock() {
    return await this.request('/telegram/check-low-stock', {
      method: 'POST',
    });
  }

  async checkExpiringMedicines() {
    return await this.request('/telegram/check-expiring', {
      method: 'POST',
    });
  }

  async checkExpiredMedicines() {
    return await this.request('/telegram/check-expired', {
      method: 'POST',
    });
  }

  async sendDailyReport(date = null) {
    return await this.request('/telegram/send-daily-report', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  async getNotificationHistory() {
    return await this.request('/telegram/notification-history');
  }

  async getMedicineNotificationSettings(medicineId) {
    return await this.request(`/medicines/${medicineId}/notification-settings`);
  }

  async updateMedicineNotificationSettings(medicineId, settings) {
    return await this.request(`/medicines/${medicineId}/notification-settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Backup and Restore
  async createBackup(options) {
    return await this.request('/backup/create', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getBackups() {
    return await this.request('/backup/list');
  }

  async getBackupPreview(backupId) {
    return await this.request(`/backup/preview/${backupId}`);
  }

  async restoreBackup(options) {
    return await this.request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async deleteBackup(backupId) {
    return await this.request(`/backup/${backupId}`, {
      method: 'DELETE',
    });
  }

  async downloadBackup(backupId) {
    const url = `${this.baseURL}/backup/download/${backupId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to download backup');
    }

    return response.blob();
  }

  async uploadBackupFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    return await this.request('/backup/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  }

  // Tally Import
  async uploadTallyPreview(file) {
    const formData = new FormData();
    formData.append('file', file);

    return await this.request('/tally/upload-preview', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  }

  async importTallyData(file, duplicateHandling = 'skip', validationStrict = true) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('duplicate_handling', duplicateHandling);
    formData.append('validation_strict', validationStrict.toString());

    return await this.request('/tally/import', {
      method: 'POST',
      body: formData,
      headers: {}, // Remove Content-Type to let browser set it for FormData
    });
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;