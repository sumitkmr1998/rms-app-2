import React, { useState, useEffect, useRef } from 'react';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';
import ShopSettings from './ShopSettings';
import OfflineUserManagement from './OfflineUserManagement';
import PrinterSettings from './PrinterSettings';
import TelegramNotifications from './TelegramNotifications';
import { 
  Settings as SettingsIcon, 
  Store, 
  Users, 
  Database, 
  MessageCircle,
  Printer,
  Download,
  Upload,
  RefreshCw,
  Shield,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Trash2,
  HardDrive
} from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('shop');
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const { 
    getBackupList, 
    createBackup, 
    restoreBackup, 
    deleteBackup, 
    downloadBackup,
    uploadBackupFile 
  } = useOfflineAuth();

  // Backup options state
  const [backupOptions, setBackupOptions] = useState({
    include_medicines: true,
    include_sales: true,
    include_stock_movements: true,
    include_shop_details: true,
    include_import_logs: true,
    include_status_checks: false,
    backup_name: ''
  });

  // Restore options state
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

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackups();
    }
  }, [activeTab]);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const fetchBackups = async () => {
    try {
      const backupList = await getBackupList();
      setBackups(backupList.backups || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
      showMessage('Error fetching backup list', 'error');
    }
  };

  const handleCreateBackup = async (e) => {
    e.preventDefault();
    setBackupLoading(true);
    
    try {
      const result = await createBackup(backupOptions);
      if (result?.success) {
        showMessage(`✅ Backup created successfully! ${result.total_records} records backed up.`, 'success');
        setBackupOptions({ ...backupOptions, backup_name: '' });
        setShowBackupModal(false);
        await fetchBackups();
      } else {
        showMessage('❌ Failed to create backup', 'error');
      }
    } catch (error) {
      showMessage('❌ Error creating backup', 'error');
    }
    
    setBackupLoading(false);
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    
    if (!selectedBackup) {
      showMessage('❌ Please select a backup to restore', 'error');
      return;
    }

    if (restoreOptions.clear_existing_data && 
        !window.confirm('⚠️ This will permanently delete all existing data before restoring. Are you sure?')) {
      return;
    }

    setRestoreLoading(true);
    
    try {
      const result = await restoreBackup({
        ...restoreOptions,
        backup_id: selectedBackup.id
      });
      
      if (result?.success) {
        const totalRestored = Object.values(result.restored_records).reduce((sum, count) => sum + count, 0);
        showMessage(`✅ Backup restored successfully! ${totalRestored} records restored.`, 'success');
        setSelectedBackup(null);
        setShowRestoreModal(false);
      } else {
        showMessage(`❌ Restore failed: ${result?.errors?.join(', ') || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showMessage('❌ Error restoring backup', 'error');
    }
    
    setRestoreLoading(false);
  };

  const handleDeleteBackup = async (backup) => {
    if (!window.confirm(`Are you sure you want to delete backup "${backup.name}"?`)) {
      return;
    }
    
    try {
      const result = await deleteBackup(backup.id);
      if (result?.success) {
        showMessage('✅ Backup deleted successfully', 'success');
        await fetchBackups();
      } else {
        showMessage('❌ Failed to delete backup', 'error');
      }
    } catch (error) {
      showMessage('❌ Error deleting backup', 'error');
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const success = await downloadBackup(backup.id, backup.name);
      if (success) {
        showMessage('✅ Backup downloaded successfully', 'success');
      } else {
        showMessage('❌ Failed to download backup', 'error');
      }
    } catch (error) {
      showMessage('❌ Error downloading backup', 'error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showMessage('❌ Please select a JSON backup file', 'error');
      return;
    }

    setUploadingFile(true);
    
    try {
      const result = await uploadBackupFile(file);
      if (result?.success) {
        showMessage(`✅ Backup file uploaded successfully: ${result.name}`, 'success');
        await fetchBackups();
      } else {
        showMessage('❌ Failed to upload backup file', 'error');
      }
    } catch (error) {
      showMessage('❌ Error uploading backup file', 'error');
    }

    setUploadingFile(false);
    event.target.value = '';
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

  // Fresh Backup & Restore UI Component
  const BackupRestoreSettings = () => (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Backup & Restore</h2>
            <p className="text-blue-100">Protect your valuable pharmacy data with automated backups</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Backups</p>
              <p className="text-2xl font-bold text-slate-900">{backups.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Latest Backup</p>
              <p className="text-lg font-semibold text-slate-900">
                {backups.length > 0 ? formatDate(backups[0].created_at).split(',')[0] : 'None'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Data Protection</p>
              <p className="text-lg font-semibold text-green-600">✓ Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
          <p className="text-sm text-slate-600">Create backups and restore data with ease</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowBackupModal(true)}
              className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 group"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-slate-900">Create Backup</span>
              <span className="text-sm text-slate-600 text-center">Backup your data now</span>
            </button>

            <button
              onClick={() => setShowRestoreModal(true)}
              disabled={backups.length === 0}
              className="flex flex-col items-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:from-green-100 hover:to-green-200 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-slate-900">Restore Data</span>
              <span className="text-sm text-slate-600 text-center">Restore from backup</span>
            </button>

            <label className="flex flex-col items-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:from-purple-100 hover:to-purple-200 transition-all duration-200 group cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploadingFile}
              />
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-slate-900">
                {uploadingFile ? 'Uploading...' : 'Upload Backup'}
              </span>
              <span className="text-sm text-slate-600 text-center">Import backup file</span>
            </label>

            <button
              onClick={fetchBackups}
              className="flex flex-col items-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 hover:from-orange-100 hover:to-orange-200 transition-all duration-200 group"
            >
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-slate-900">Refresh List</span>
              <span className="text-sm text-slate-600 text-center">Update backup list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Available Backups</h3>
          <p className="text-sm text-slate-600">Manage your existing backups</p>
        </div>
        <div className="divide-y divide-slate-200">
          {backups.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">No backups found</h4>
              <p className="text-slate-600 mb-4">Create your first backup to protect your data</p>
              <button
                onClick={() => setShowBackupModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Backup
              </button>
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">{backup.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(backup.created_at)}
                        </span>
                        <span>{formatFileSize(backup.file_size)}</span>
                        <span>{backup.total_records} records</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {backup.data_categories.map((category) => (
                          <span key={category} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                            {category.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadBackup(backup)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download backup"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBackup(backup);
                        setShowRestoreModal(true);
                      }}
                      className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Restore backup"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup)}
                      className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete backup"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Create New Backup</h2>
              <button
                onClick={() => setShowBackupModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateBackup} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Backup Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={backupOptions.backup_name}
                  onChange={(e) => setBackupOptions({ ...backupOptions, backup_name: e.target.value })}
                  placeholder="Enter backup name (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Data to Include
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'include_medicines', label: 'Medicine Inventory', desc: 'All medicine data and stock levels' },
                    { key: 'include_sales', label: 'Sales Records', desc: 'Transaction history and receipts' },
                    { key: 'include_stock_movements', label: 'Stock Movements', desc: 'Inventory movement logs' },
                    { key: 'include_shop_details', label: 'Shop Information', desc: 'Store settings and details' },
                    { key: 'include_import_logs', label: 'Import Logs', desc: 'Data import history' },
                    { key: 'include_status_checks', label: 'Status Checks', desc: 'System status logs' }
                  ].map((option) => (
                    <label key={option.key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupOptions[option.key]}
                        onChange={(e) => setBackupOptions({ ...backupOptions, [option.key]: e.target.checked })}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{option.label}</div>
                        <div className="text-sm text-slate-600">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowBackupModal(false)}
                  className="px-6 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                  disabled={backupLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  disabled={backupLoading}
                >
                  {backupLoading ? 'Creating Backup...' : 'Create Backup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Restore from Backup</h2>
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackup(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRestoreBackup} className="space-y-6">
              {!selectedBackup && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Select Backup to Restore
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {backups.map((backup) => (
                      <label key={backup.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name="selectedBackup"
                          onChange={() => setSelectedBackup(backup)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{backup.name}</div>
                          <div className="text-sm text-slate-600">{formatDate(backup.created_at)} • {backup.total_records} records</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedBackup && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-1">Selected Backup</h3>
                  <p className="text-blue-700">{selectedBackup.name}</p>
                  <p className="text-sm text-blue-600">{formatDate(selectedBackup.created_at)} • {selectedBackup.total_records} records</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Restore Options
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'include_medicines', label: 'Medicine Inventory' },
                    { key: 'include_sales', label: 'Sales Records' },
                    { key: 'include_stock_movements', label: 'Stock Movements' },
                    { key: 'include_shop_details', label: 'Shop Information' },
                    { key: 'include_import_logs', label: 'Import Logs' },
                    { key: 'include_status_checks', label: 'Status Checks' }
                  ].map((option) => (
                    <label key={option.key} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions[option.key]}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, [option.key]: e.target.checked })}
                      />
                      <div className="font-medium text-slate-900">{option.label}</div>
                    </label>
                  ))}
                  
                  <label className="flex items-start gap-3 p-3 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreOptions.clear_existing_data}
                      onChange={(e) => setRestoreOptions({ ...restoreOptions, clear_existing_data: e.target.checked })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-red-900">Clear existing data before restore</div>
                      <div className="text-sm text-red-700">⚠️ This will permanently delete all current data</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedBackup(null);
                  }}
                  className="px-6 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                  disabled={restoreLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                  disabled={restoreLoading || !selectedBackup}
                >
                  {restoreLoading ? 'Restoring...' : 'Restore Backup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'shop', label: 'Shop Settings', icon: Store, component: ShopSettings },
    { id: 'users', label: 'User Management', icon: Users, component: OfflineUserManagement },
    { id: 'printer', label: 'Printer Settings', icon: Printer, component: PrinterSettings },
    { id: 'backup', label: 'Backup & Restore', icon: Database, component: BackupRestoreSettings },
    { id: 'telegram', label: 'Telegram Alerts', icon: MessageCircle, component: TelegramNotifications }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
              <p className="text-slate-600">Manage your pharmacy system configuration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            messageType === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {messageType === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {message}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-slate-200">
            <nav className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[600px]">
            {activeTab === 'shop' && <ShopSettings />}
            {activeTab === 'users' && <OfflineUserManagement />}
            {activeTab === 'printer' && <PrinterSettings />}
            {activeTab === 'backup' && <BackupRestoreSettings />}
            {activeTab === 'telegram' && <TelegramNotifications />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;