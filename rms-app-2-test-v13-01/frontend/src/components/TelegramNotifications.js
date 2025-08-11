import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { MessageCircle, Send, Bell, Clock, Package, AlertTriangle, Calendar, CheckCircle, X, Info } from 'lucide-react';

const TelegramNotifications = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState({});
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    bot_token: '',
    chat_id: '',
    enabled: false,
    daily_sales_report_enabled: true,
    daily_sales_report_time: '18:00',
    low_stock_alerts_enabled: true,
    low_stock_threshold: 10,
    immediate_low_stock_alerts: true,
    daily_low_stock_reminder: true,
    daily_low_stock_reminder_time: '09:00',
    near_expiry_alerts_enabled: true,
    near_expiry_days_threshold: 30,
    near_expiry_alert_time: '09:00',
    expired_alerts_enabled: true,
    expired_alert_time: '09:00'
  });

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const loadSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/settings`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      const data = await response.json();
      setSettings(data);
      setFormData({...formData, ...data});
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('Error loading Telegram settings', 'error');
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/history`);
      if (!response.ok) {
        throw new Error('Failed to load history');
      }
      
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      showMessage('Telegram settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('Error saving Telegram settings', 'error');
    }
    setLoading(false);
  };

  const testConnection = async () => {
    setTestLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_token: formData.bot_token,
          chat_id: formData.chat_id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to test connection');
      }

      const result = await response.json();
      if (result.success) {
        showMessage('Connection test successful!', 'success');
      } else {
        showMessage(`Connection test failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      showMessage('Error testing connection', 'error');
    }
    setTestLoading(false);
  };

  const sendTestNotification = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/send-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      const result = await response.json();
      if (result.success) {
        showMessage('Test notification sent successfully!', 'success');
        loadHistory();
      } else {
        showMessage(`Failed to send test notification: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      showMessage('Error sending test notification', 'error');
    }
  };

  const sendManualNotification = async (type) => {
    setManualLoading(prev => ({...prev, [type]: true}));
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/telegram/send-manual/${type}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      const result = await response.json();
      if (result.success) {
        showMessage(`${type.replace('_', ' ').toUpperCase()} notification sent successfully!`, 'success');
        loadHistory();
      } else {
        showMessage(`Failed to send notification: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      showMessage('Error sending notification', 'error');
    }
    setManualLoading(prev => ({...prev, [type]: false}));
  };

  const getStatusColor = (success) => {
    return success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'daily_sales': return <Package className="w-4 h-4" />;
      case 'low_stock': return <AlertTriangle className="w-4 h-4" />;
      case 'near_expiry': return <Calendar className="w-4 h-4" />;
      case 'expired': return <X className="w-4 h-4" />;
      case 'test': return <CheckCircle className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Telegram Notifications</h1>
              <p className="text-slate-600">Configure automated notifications for your pharmacy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Clock className="w-4 h-4 mr-2" />
                  Notification History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Notification History</DialogTitle>
                  <DialogDescription>
                    Recent Telegram notifications sent from your pharmacy
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No notifications sent yet</p>
                  ) : (
                    history.map((notification, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(notification.type)}
                            <span className="font-medium capitalize">
                              {notification.type.replace('_', ' ')}
                            </span>
                            <Badge className={getStatusColor(notification.success)}>
                              {notification.success ? 'Sent' : 'Failed'}
                            </Badge>
                          </div>
                          <span className="text-sm text-slate-500">
                            {new Date(notification.sent_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap mb-2">
                          {notification.message.substring(0, 200)}
                          {notification.message.length > 200 ? '...' : ''}
                        </p>
                        {!notification.success && notification.error_message && (
                          <p className="text-sm text-red-600">
                            Error: {notification.error_message}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Badge variant={settings.enabled ? 'default' : 'secondary'}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <Alert className={messageType === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
            <AlertDescription className={messageType === 'error' ? 'text-red-700' : 'text-green-700'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Configure your Telegram bot and notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="setup" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup">Bot Setup</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="manual">Manual Send</TabsTrigger>
              </TabsList>

              {/* Bot Setup Tab */}
              <TabsContent value="setup" className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bot Token</Label>
                      <Input
                        type="password"
                        value={formData.bot_token}
                        onChange={(e) => setFormData({...formData, bot_token: e.target.value})}
                        placeholder="Enter your Telegram bot token"
                      />
                      <p className="text-sm text-slate-500">
                        Get from @BotFather on Telegram
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Chat ID</Label>
                      <Input
                        value={formData.chat_id}
                        onChange={(e) => setFormData({...formData, chat_id: e.target.value})}
                        placeholder="Enter chat ID"
                      />
                      <p className="text-sm text-slate-500">
                        Your Telegram chat ID or channel ID
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData({...formData, enabled: checked})}
                    />
                    <Label>Enable Telegram Notifications</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={testConnection}
                      disabled={testLoading || !formData.bot_token || !formData.chat_id}
                      variant="outline"
                    >
                      {testLoading ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button 
                      onClick={saveSettings}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <div className="space-y-6">
                  {/* Daily Sales Report */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold">Daily Sales Report</h3>
                      </div>
                      <Switch
                        checked={formData.daily_sales_report_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, daily_sales_report_enabled: checked})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Report Time</Label>
                      <Input
                        type="time"
                        value={formData.daily_sales_report_time}
                        onChange={(e) => setFormData({...formData, daily_sales_report_time: e.target.value})}
                        className="w-32"
                      />
                    </div>
                  </div>

                  {/* Low Stock Alerts */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <h3 className="font-semibold">Low Stock Alerts</h3>
                      </div>
                      <Switch
                        checked={formData.low_stock_alerts_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, low_stock_alerts_enabled: checked})}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Stock Threshold</Label>
                        <Input
                          type="number"
                          value={formData.low_stock_threshold}
                          onChange={(e) => setFormData({...formData, low_stock_threshold: parseInt(e.target.value)})}
                          className="w-32"
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={formData.immediate_low_stock_alerts}
                            onCheckedChange={(checked) => setFormData({...formData, immediate_low_stock_alerts: checked})}
                          />
                          <Label>Send immediate alerts when stock goes low</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={formData.daily_low_stock_reminder}
                            onCheckedChange={(checked) => setFormData({...formData, daily_low_stock_reminder: checked})}
                          />
                          <Label>Send daily low stock reminder</Label>
                        </div>
                        {formData.daily_low_stock_reminder && (
                          <div className="space-y-2 ml-6">
                            <Label>Reminder Time</Label>
                            <Input
                              type="time"
                              value={formData.daily_low_stock_reminder_time}
                              onChange={(e) => setFormData({...formData, daily_low_stock_reminder_time: e.target.value})}
                              className="w-32"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Near Expiry Alerts */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-orange-600" />
                        <h3 className="font-semibold">Near Expiry Alerts</h3>
                      </div>
                      <Switch
                        checked={formData.near_expiry_alerts_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, near_expiry_alerts_enabled: checked})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Days Before Expiry</Label>
                        <Input
                          type="number"
                          value={formData.near_expiry_days_threshold}
                          onChange={(e) => setFormData({...formData, near_expiry_days_threshold: parseInt(e.target.value)})}
                          className="w-32"
                          min="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alert Time</Label>
                        <Input
                          type="time"
                          value={formData.near_expiry_alert_time}
                          onChange={(e) => setFormData({...formData, near_expiry_alert_time: e.target.value})}
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expired Products Alerts */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <X className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold">Expired Products Alerts</h3>
                      </div>
                      <Switch
                        checked={formData.expired_alerts_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, expired_alerts_enabled: checked})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alert Time</Label>
                      <Input
                        type="time"
                        value={formData.expired_alert_time}
                        onChange={(e) => setFormData({...formData, expired_alert_time: e.target.value})}
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={loading} className="w-full">
                  {loading ? 'Saving...' : 'Save Notification Settings'}
                </Button>
              </TabsContent>

              {/* Manual Send Tab */}
              <TabsContent value="manual" className="space-y-6">
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 mb-4">
                    Send notifications manually to test or get immediate reports
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={sendTestNotification}
                      disabled={!settings.enabled}
                      variant="outline"
                      className="flex items-center gap-2 h-12"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Send Test Notification
                    </Button>

                    <Button
                      onClick={() => sendManualNotification('daily_sales')}
                      disabled={!settings.enabled || manualLoading.daily_sales}
                      variant="outline"
                      className="flex items-center gap-2 h-12"
                    >
                      <Package className="w-5 h-5" />
                      {manualLoading.daily_sales ? 'Sending...' : 'Daily Sales Report'}
                    </Button>

                    <Button
                      onClick={() => sendManualNotification('low_stock')}
                      disabled={!settings.enabled || manualLoading.low_stock}
                      variant="outline"
                      className="flex items-center gap-2 h-12"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      {manualLoading.low_stock ? 'Sending...' : 'Low Stock Alert'}
                    </Button>

                    <Button
                      onClick={() => sendManualNotification('near_expiry')}
                      disabled={!settings.enabled || manualLoading.near_expiry}
                      variant="outline"
                      className="flex items-center gap-2 h-12"
                    >
                      <Calendar className="w-5 h-5" />
                      {manualLoading.near_expiry ? 'Sending...' : 'Near Expiry Alert'}
                    </Button>

                    <Button
                      onClick={() => sendManualNotification('expired')}
                      disabled={!settings.enabled || manualLoading.expired}
                      variant="outline"
                      className="flex items-center gap-2 h-12 col-span-2"
                    >
                      <X className="w-5 h-5" />
                      {manualLoading.expired ? 'Sending...' : 'Expired Products Alert'}
                    </Button>
                  </div>

                  {!settings.enabled && (
                    <Alert>
                      <Info className="w-4 h-4" />
                      <AlertDescription>
                        Enable Telegram notifications in the Bot Setup tab to send manual notifications.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TelegramNotifications;