import React, { useState, useEffect } from 'react';

const TelegramNotifications = () => {
  const [telegramSettings, setTelegramSettings] = useState({
    bot_token: '',
    chat_id: '',
    notifications_enabled: true,
    low_stock_alerts_enabled: true,
    expiry_alerts_enabled: true,
    expired_alerts_enabled: true,
    daily_reports_enabled: true,
    daily_report_time: '18:00',
    low_stock_check_time: '0 */4 * * *',
    expiry_check_time: '0 9 * * *',
    expired_check_time: '0 10 * * *',
    timezone: 'UTC'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('settings');
  const [testLoading, setTestLoading] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchTelegramSettings();
    if (activeTab === 'history') {
      fetchNotificationHistory();
    }
  }, [activeTab]);

  const fetchTelegramSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/settings`);
      if (response.ok) {
        const data = await response.json();
        setTelegramSettings({
          ...data,
          bot_token: data.bot_token === '***CONFIGURED***' ? '***CONFIGURED***' : data.bot_token || ''
        });
      }
    } catch (error) {
      console.error('Error fetching Telegram settings:', error);
    }
  };

  const fetchNotificationHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/notification-history`);
      if (response.ok) {
        const data = await response.json();
        setNotificationHistory(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notification history:', error);
    }
    setHistoryLoading(false);
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const updateData = {
        ...telegramSettings
      };

      // Don't send the masked token
      if (updateData.bot_token === '***CONFIGURED***') {
        delete updateData.bot_token;
      }

      console.log('Sending update request:', updateData);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        setTelegramSettings({
          ...data,
          bot_token: data.bot_token === '***CONFIGURED***' ? '***CONFIGURED***' : data.bot_token || ''
        });
        setMessage('✅ Telegram settings updated successfully!');
        console.log('Success message set');
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        setMessage(`❌ Failed to update settings (Status: ${response.status})`);
      }
    } catch (error) {
      console.error('Network Error:', error);
      setMessage(`❌ Error updating settings: ${error.message}`);
    }

    setLoading(false);
    // Increase timeout to 10 seconds for better visibility
    setTimeout(() => setMessage(''), 10000);
  };

  const handleTestConnection = async () => {
    if (!telegramSettings.bot_token || !telegramSettings.chat_id) {
      setMessage('❌ Please enter both Bot Token and Chat ID first');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (telegramSettings.bot_token === '***CONFIGURED***') {
      setMessage('❌ Please re-enter your Bot Token to test');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setTestLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: telegramSettings.bot_token,
          chat_id: telegramSettings.chat_id,
          message: '🧪 <b>Test Notification</b>\\n\\n✅ Your MediPOS RMS Telegram notifications are working correctly!'
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Test notification sent successfully! Check your Telegram.');
      } else {
        setMessage(`❌ Test failed: ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Error testing connection');
    }

    setTestLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleManualReport = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/send-daily-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Daily sales report sent successfully!');
      } else {
        setMessage(`❌ Failed to send report: ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ Error sending report');
    }

    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCheckLowStock = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/check-low-stock`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        if (result.medicines.length > 0) {
          setMessage(`✅ Low stock alert sent for ${result.medicines.length} medicines!`);
        } else {
          setMessage('✅ No medicines with low stock found.');
        }
      } else {
        setMessage('❌ Failed to check low stock');
      }
    } catch (error) {
      setMessage('❌ Error checking low stock');
    }

    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCheckExpiring = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/check-expiring`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        if (result.medicines.length > 0) {
          setMessage(`✅ Expiry alert sent for ${result.medicines.length} medicines!`);
        } else {
          setMessage('✅ No medicines expiring soon found.');
        }
      } else {
        setMessage('❌ Failed to check expiring medicines');
      }
    } catch (error) {
      setMessage('❌ Error checking expiring medicines');
    }

    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleCheckExpired = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/check-expired`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        if (result.medicines.length > 0) {
          const totalValue = result.total_expired_value || 0;
          setMessage(`🚨 Expired medicines alert sent! Found ${result.medicines.length} expired medicines with total value ₹${totalValue.toFixed(2)}`);
        } else {
          setMessage('✅ No expired medicines with remaining stock found.');
        }
      } else {
        setMessage('❌ Failed to check expired medicines');
      }
    } catch (error) {
      setMessage('❌ Error checking expired medicines');
    }

    setLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': 
        return 'text-green-600 bg-green-50';
      case 'failed': 
        return 'text-red-600 bg-red-50';
      case 'pending': 
        return 'text-yellow-600 bg-yellow-50';
      default: 
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getNotificationTypeIcon = (type) => {
    switch (type) {
      case 'low_stock': 
        return '📦';
      case 'expiry': 
        return '⏰';
      case 'expired': 
        return '🚨';
      case 'daily_report': 
        return '📊';
      default: 
        return '🔔';
    }
  };

  // Helper function to convert cron to user-friendly description
  const cronToDescription = (cronExpression) => {
    switch (cronExpression) {
      case '0 */1 * * *':
        return 'Every hour';
      case '0 */2 * * *':
        return 'Every 2 hours';
      case '0 */3 * * *':
        return 'Every 3 hours';
      case '0 */4 * * *':
        return 'Every 4 hours';
      case '0 */6 * * *':
        return 'Every 6 hours';
      case '0 */8 * * *':
        return 'Every 8 hours';
      case '0 */12 * * *':
        return 'Every 12 hours';
      case '0 6 * * *':
        return 'Daily at 6:00 AM';
      case '0 8 * * *':
        return 'Daily at 8:00 AM';
      case '0 9 * * *':
        return 'Daily at 9:00 AM';
      case '0 10 * * *':
        return 'Daily at 10:00 AM';
      case '0 12 * * *':
        return 'Daily at 12:00 PM';
      case '0 14 * * *':
        return 'Daily at 2:00 PM';
      case '0 16 * * *':
        return 'Daily at 4:00 PM';
      case '0 18 * * *':
        return 'Daily at 6:00 PM';
      default:
        return cronExpression;
    }
  };

  // Predefined cron options
  const cronOptions = [
    { value: '0 */1 * * *', label: 'Every hour' },
    { value: '0 */2 * * *', label: 'Every 2 hours' },
    { value: '0 */3 * * *', label: 'Every 3 hours' },
    { value: '0 */4 * * *', label: 'Every 4 hours' },
    { value: '0 */6 * * *', label: 'Every 6 hours' },
    { value: '0 */8 * * *', label: 'Every 8 hours' },
    { value: '0 */12 * * *', label: 'Every 12 hours' }
  ];

  const dailyCronOptions = [
    { value: '0 6 * * *', label: 'Daily at 6:00 AM' },
    { value: '0 8 * * *', label: 'Daily at 8:00 AM' },
    { value: '0 9 * * *', label: 'Daily at 9:00 AM' },
    { value: '0 10 * * *', label: 'Daily at 10:00 AM' },
    { value: '0 12 * * *', label: 'Daily at 12:00 PM' },
    { value: '0 14 * * *', label: 'Daily at 2:00 PM' },
    { value: '0 16 * * *', label: 'Daily at 4:00 PM' },
    { value: '0 18 * * *', label: 'Daily at 6:00 PM' }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="border-b border-slate-200 p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">📱 Telegram Notifications</h1>
            <p className="text-slate-600">Configure and manage Telegram notifications for your pharmacy</p>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-lg font-semibold text-center border-2 ${
              message.includes('✅') ? 'bg-green-100 border-green-300 text-green-900' :
              message.includes('⚠️') ? 'bg-yellow-100 border-yellow-300 text-yellow-900' :
              'bg-red-100 border-red-300 text-red-900'
            }`}>
              <div className="text-lg">{message}</div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <nav className="flex p-6 space-x-8">
              {[
                { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
                { id: 'testing', label: '🧪 Testing', icon: '🧪' },
                { id: 'history', label: '📜 History', icon: '📜' }
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
            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-4">Telegram Bot Configuration</h2>
                  
                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Setup Instructions:</h3>
                    <ol className="text-blue-800 text-sm space-y-1 ml-4 list-decimal">
                      <li>Message @BotFather on Telegram and create a new bot with /newbot</li>
                      <li>Copy the Bot Token from BotFather</li>
                      <li>Start a chat with your bot and send any message</li>
                      <li>Get your Chat ID by visiting: https://api.telegram.org/bot[YOUR_BOT_TOKEN]/getUpdates</li>
                      <li>Look for "chat":&lbrace;"id": and copy that number</li>
                    </ol>
                  </div>

                  <form onSubmit={handleUpdateSettings} className="space-y-6">
                    {/* Bot Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Bot Token <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={telegramSettings.bot_token}
                          onChange={(e) => setTelegramSettings({...telegramSettings, bot_token: e.target.value})}
                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                          required
                        />
                        <p className="text-xs text-slate-500 mt-1">Get this from @BotFather on Telegram</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Chat ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={telegramSettings.chat_id}
                          onChange={(e) => setTelegramSettings({...telegramSettings, chat_id: e.target.value})}
                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="123456789"
                          required
                        />
                        <p className="text-xs text-slate-500 mt-1">Your Telegram Chat ID or Group ID</p>
                      </div>
                    </div>

                    {/* Notification Settings with Custom Timing */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Notification Settings & Timing</h3>
                      <div className="space-y-6">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="notifications_enabled"
                            checked={telegramSettings.notifications_enabled}
                            onChange={(e) => setTelegramSettings({...telegramSettings, notifications_enabled: e.target.checked})}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="notifications_enabled" className="ml-3 text-sm font-medium text-slate-700">
                            🔔 Enable All Notifications
                          </label>
                        </div>

                        {/* Low Stock Alerts */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              id="low_stock_alerts"
                              checked={telegramSettings.low_stock_alerts_enabled}
                              onChange={(e) => setTelegramSettings({...telegramSettings, low_stock_alerts_enabled: e.target.checked})}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="low_stock_alerts" className="ml-3 text-sm font-medium text-slate-700">
                              📦 Low Stock Alerts
                            </label>
                          </div>
                          {telegramSettings.low_stock_alerts_enabled && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Check Frequency:</label>
                              <select
                                value={telegramSettings.low_stock_check_time}
                                onChange={(e) => setTelegramSettings({...telegramSettings, low_stock_check_time: e.target.value})}
                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {cronOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Expiry Alerts */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              id="expiry_alerts"
                              checked={telegramSettings.expiry_alerts_enabled}
                              onChange={(e) => setTelegramSettings({...telegramSettings, expiry_alerts_enabled: e.target.checked})}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="expiry_alerts" className="ml-3 text-sm font-medium text-slate-700">
                              ⏰ Expiry Alerts (Medicines expiring soon)
                            </label>
                          </div>
                          {telegramSettings.expiry_alerts_enabled && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Check Time:</label>
                              <select
                                value={telegramSettings.expiry_check_time}
                                onChange={(e) => setTelegramSettings({...telegramSettings, expiry_check_time: e.target.value})}
                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {dailyCronOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Expired Alerts */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              id="expired_alerts"
                              checked={telegramSettings.expired_alerts_enabled}
                              onChange={(e) => setTelegramSettings({...telegramSettings, expired_alerts_enabled: e.target.checked})}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="expired_alerts" className="ml-3 text-sm font-medium text-slate-700">
                              🚨 Expired Medicines Alerts
                            </label>
                          </div>
                          {telegramSettings.expired_alerts_enabled && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Check Time:</label>
                              <select
                                value={telegramSettings.expired_check_time}
                                onChange={(e) => setTelegramSettings({...telegramSettings, expired_check_time: e.target.value})}
                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                {dailyCronOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Daily Reports */}
                        <div className="bg-slate-50 p-4 rounded-lg">
                          <div className="flex items-center mb-3">
                            <input
                              type="checkbox"
                              id="daily_reports"
                              checked={telegramSettings.daily_reports_enabled}
                              onChange={(e) => setTelegramSettings({...telegramSettings, daily_reports_enabled: e.target.checked})}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="daily_reports" className="ml-3 text-sm font-medium text-slate-700">
                              📊 Daily Sales Reports
                            </label>
                          </div>
                          {telegramSettings.daily_reports_enabled && (
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Report Time:</label>
                              <input
                                type="time"
                                value={telegramSettings.daily_report_time}
                                onChange={(e) => setTelegramSettings({...telegramSettings, daily_report_time: e.target.value})}
                                className="w-32 p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <p className="text-xs text-slate-500 mt-1">Time when daily sales reports will be sent</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '⏳ Saving...' : '💾 Save Settings'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Testing Tab */}
            {activeTab === 'testing' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-4">Test Notifications</h2>
                  <p className="text-slate-600 mb-6">Test your Telegram bot configuration and manually trigger notifications</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">🧪 Connection Test</h3>
                    <p className="text-slate-600 mb-4">Send a test message to verify your bot configuration</p>
                    <button
                      onClick={handleTestConnection}
                      disabled={testLoading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {testLoading ? '⏳ Testing...' : '🧪 Test Connection'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">📊 Manual Reports</h3>
                    <p className="text-slate-600 mb-4">Manually trigger daily sales report</p>
                    <button
                      onClick={handleManualReport}
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '⏳ Sending...' : '📊 Send Daily Report'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">📦 Low Stock Check</h3>
                    <p className="text-slate-600 mb-4">Check and alert for medicines with low stock</p>
                    <button
                      onClick={handleCheckLowStock}
                      disabled={loading}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '⏳ Checking...' : '📦 Check Low Stock'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">⏰ Expiry Check</h3>
                    <p className="text-slate-600 mb-4">Check and alert for medicines expiring soon</p>
                    <button
                      onClick={handleCheckExpiring}
                      disabled={loading}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '⏳ Checking...' : '⏰ Check Expiring'}
                    </button>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">🚨 Expired Check</h3>
                    <p className="text-slate-600 mb-4">Check and alert for medicines that have already expired</p>
                    <button
                      onClick={handleCheckExpired}
                      disabled={loading}
                      className="bg-red-800 text-white px-4 py-2 rounded-lg hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? '⏳ Checking...' : '🚨 Check Expired'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Notification History</h2>
                    <p className="text-slate-600">Recent notification activity and status</p>
                  </div>
                  <button
                    onClick={fetchNotificationHistory}
                    disabled={historyLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {historyLoading ? '⏳ Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>

                {historyLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-slate-600 mt-2">Loading notification history...</p>
                  </div>
                ) : notificationHistory.length > 0 ? (
                  <div className="space-y-4">
                    {notificationHistory.map((notification) => (
                      <div key={notification.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <span className="text-2xl">{getNotificationTypeIcon(notification.notification_type)}</span>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-semibold text-slate-900 capitalize">
                                  {notification.notification_type.replace('_', ' ')} Notification
                                </h4>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(notification.status)}`}>
                                  {notification.status}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">
                                {formatDateTime(notification.created_at)}
                              </p>
                              {notification.error_message && (
                                <p className="text-sm text-red-600 mt-2">
                                  Error: {notification.error_message}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <span className="text-4xl block mb-2">📭</span>
                    <p>No notification history available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramNotifications;