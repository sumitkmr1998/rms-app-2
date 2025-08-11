import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Separator } from './ui/separator';
import { Store, Edit2, Check, AlertCircle, Info, Building, Phone, Mail, FileText, CreditCard } from 'lucide-react';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';

const ShopSettings = () => {
  const [showEditShop, setShowEditShop] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    license_number: '',
    gst_number: ''
  });
  const [shopLoading, setShopLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [shop, setShop] = useState(null);

  const { getShop, updateShop } = useOfflineAuth();

  // Fetch shop details on component mount
  useEffect(() => {
    fetchShop();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const fetchShop = async () => {
    try {
      const shopData = await getShop();
      setShop(shopData);
    } catch (error) {
      console.error('Error fetching shop details:', error);
      showMessage('Error loading shop details', 'error');
    }
  };

  const resetShopForm = () => {
    setShopForm({
      name: '',
      address: '',
      phone: '',
      email: '',
      license_number: '',
      gst_number: ''
    });
  };

  const openEditShop = () => {
    if (shop) {
      setShopForm({
        name: shop.name || '',
        address: shop.address || '',
        phone: shop.phone || '',
        email: shop.email || '',
        license_number: shop.license_number || '',
        gst_number: shop.gst_number || ''
      });
    } else {
      resetShopForm();
    }
    setShowEditShop(true);
  };

  const handleEditShop = async (e) => {
    e.preventDefault();
    setShopLoading(true);

    try {
      const updatedShop = await updateShop(shopForm);
      
      if (updatedShop) {
        setShowEditShop(false);
        resetShopForm();
        await fetchShop();
        showMessage('Shop details updated successfully', 'success');
      } else {
        showMessage('Error updating shop details', 'error');
      }
    } catch (error) {
      showMessage('Error updating shop details', 'error');
    }
    
    setShopLoading(false);
  };

  const shopFields = [
    { key: 'name', label: 'Shop Name', icon: Building, required: true },
    { key: 'phone', label: 'Phone Number', icon: Phone, required: true },
    { key: 'email', label: 'Email Address', icon: Mail, required: false },
    { key: 'address', label: 'Address', icon: Building, required: true, multiline: true },
    { key: 'license_number', label: 'License Number', icon: FileText, required: false },
    { key: 'gst_number', label: 'GST Number', icon: CreditCard, required: false }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Shop Settings</h2>
          <p className="text-slate-600">Manage your pharmacy's information and details</p>
        </div>
        <Button onClick={openEditShop} className="flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          Edit Shop Details
        </Button>
      </div>

      {/* Message Display */}
      {message && (
        <Alert className={
          messageType === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
        }>
          {messageType === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <AlertDescription className={
            messageType === 'error' ? 'text-red-700' : 'text-green-700'
          }>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Shop Information Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Shop Information
          </CardTitle>
          <CardDescription>
            Current shop details and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shopFields.map((field) => (
              <div key={field.key} className={field.key === 'address' ? 'md:col-span-2' : ''}>
                <div className="flex items-center gap-2 mb-2">
                  <field.icon className="w-4 h-4 text-slate-500" />
                  <Label className="text-sm font-semibold text-slate-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[44px] flex items-center">
                  <p className="text-slate-900">
                    {shop?.[field.key] || (
                      <span className="text-slate-500 italic">Not set</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <Separator className="my-6" />
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${shop && shop.name ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-slate-600">
                Setup Status: {shop && shop.name ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            {(!shop || !shop.name) && (
              <Button variant="outline" size="sm" onClick={openEditShop}>
                Complete Setup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">1</div>
              <div>
                <p className="font-medium text-slate-900">Basic Information</p>
                <p className="text-sm text-slate-600">Enter your shop name, address, and contact details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">2</div>
              <div>
                <p className="font-medium text-slate-900">Legal Information</p>
                <p className="text-sm text-slate-600">Add your pharmacy license number and GST details</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">3</div>
              <div>
                <p className="font-medium text-slate-900">Verification</p>
                <p className="text-sm text-slate-600">Review and save your shop information</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Shop Dialog */}
      <Dialog open={showEditShop} onOpenChange={setShowEditShop}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shop Details</DialogTitle>
            <DialogDescription>
              Update your pharmacy's information and contact details
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditShop} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopFields.map((field) => (
                <div key={field.key} className={field.key === 'address' ? 'md:col-span-2' : ''}>
                  <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <field.icon className="w-4 h-4" />
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  {field.multiline ? (
                    <textarea
                      required={field.required}
                      rows={3}
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      value={shopForm[field.key]}
                      onChange={(e) => setShopForm({ ...shopForm, [field.key]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <Input
                      type={field.key === 'email' ? 'email' : 'text'}
                      required={field.required}
                      value={shopForm[field.key]}
                      onChange={(e) => setShopForm({ ...shopForm, [field.key]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditShop(false)}
                disabled={shopLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={shopLoading}
              >
                {shopLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopSettings;