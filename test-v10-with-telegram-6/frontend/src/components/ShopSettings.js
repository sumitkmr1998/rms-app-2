import React, { useState, useEffect } from 'react';
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
  const [shopMessage, setShopMessage] = useState('');
  const [shop, setShop] = useState(null);

  const { getShop, updateShop } = useOfflineAuth();

  // Fetch shop details on component mount
  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    try {
      const shopData = await getShop();
      setShop(shopData);
    } catch (error) {
      console.error('Error fetching shop details:', error);
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
    setShopMessage('');

    try {
      const updatedShop = await updateShop(shopForm);
      
      if (updatedShop) {
        setShowEditShop(false);
        resetShopForm();
        await fetchShop(); // Wait for fetch to complete
        setShopMessage('Shop details updated successfully');
        setTimeout(() => setShopMessage(''), 3000);
      } else {
        setShopMessage('Error updating shop details');
      }
    } catch (error) {
      setShopMessage('Error updating shop details');
    }
    
    setShopLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="border-b border-slate-200 pb-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Shop Settings</h1>
                <p className="text-slate-600 mt-1">Manage your shop's information and details</p>
              </div>
              <button
                onClick={openEditShop}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                ✏️ Edit Shop Details
              </button>
            </div>
          </div>

          {/* Shop Information Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Shop Name</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.name || 'Not set'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.phone || 'Not set'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.email || 'Not set'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.address || 'Not set'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">License Number</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.license_number || 'Not set'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">GST Number</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-900">{shop?.gst_number || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {shopMessage && (
            <div className={`p-4 rounded-lg mb-6 ${
              shopMessage.includes('successfully') 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {shopMessage}
            </div>
          )}
        </div>
      </div>

      {/* Edit Shop Modal */}
      {showEditShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Edit Shop Details</h2>
              <button
                onClick={() => setShowEditShop(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditShop} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.name}
                    onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                    placeholder="Enter shop name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.phone}
                    onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Address *
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.address}
                    onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                    placeholder="Enter complete address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.email}
                    onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    License Number
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.license_number}
                    onChange={(e) => setShopForm({ ...shopForm, license_number: e.target.value })}
                    placeholder="Enter license number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    GST Number
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={shopForm.gst_number}
                    onChange={(e) => setShopForm({ ...shopForm, gst_number: e.target.value })}
                    placeholder="Enter GST number"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditShop(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                  disabled={shopLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  disabled={shopLoading}
                >
                  {shopLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopSettings;