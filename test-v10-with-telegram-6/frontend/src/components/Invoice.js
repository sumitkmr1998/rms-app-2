import React, { forwardRef } from 'react';

const Invoice = forwardRef(({ sale, shop, type = 'invoice' }, ref) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const isReturn = sale?.is_return || sale?.total_amount < 0;

  return (
    <div ref={ref} className="invoice-print bg-white p-6 max-w-2xl mx-auto">
      {/* Shop Header */}
      <div className="text-center border-b-2 border-gray-300 pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{shop?.name || 'MediPOS Pharmacy'}</h1>
        {shop?.address && <p className="text-gray-600">{shop.address}</p>}
        <div className="flex justify-center gap-4 text-sm text-gray-600 mt-2">
          {shop?.phone && <span>📞 {shop.phone}</span>}
          {shop?.email && <span>📧 {shop.email}</span>}
        </div>
        <div className="flex justify-center gap-4 text-sm text-gray-600">
          {shop?.license_number && <span>License: {shop.license_number}</span>}
          {shop?.gst_number && <span>GST: {shop.gst_number}</span>}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="flex justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isReturn ? '🔄 RETURN RECEIPT' : type === 'receipt' ? '🧾 RECEIPT' : '📄 INVOICE'}
          </h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p><span className="font-medium">Receipt #:</span> {sale?.receipt_number}</p>
            <p><span className="font-medium">Date:</span> {formatDate(sale?.created_at)}</p>
            <p><span className="font-medium">Cashier:</span> {sale?.cashier_name || 'Staff'}</p>
          </div>
        </div>
        <div className="text-right">
          {sale?.customer_name && (
            <div className="text-sm text-gray-600 space-y-1">
              <h3 className="font-medium text-gray-900">Customer Details</h3>
              <p>{sale.customer_name}</p>
              {sale?.customer_phone && <p>📱 {sale.customer_phone}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Item</th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">Qty</th>
              <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Rate</th>
              <th className="border border-gray-300 px-3 py-2 text-right text-sm font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale?.items?.map((item, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-3 py-2 text-sm">
                  {item.is_return && '🔄 '}{item.medicine_name}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                  {item.is_return ? `-${item.quantity}` : item.quantity}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                  {formatCurrency(item.price)}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                  {item.is_return ? `-${formatCurrency(item.total)}` : formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t-2 border-gray-300 pt-4">
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Subtotal:</span>
              <span>{formatCurrency(Math.abs(sale?.subtotal_amount || sale?.total_amount || 0))}</span>
            </div>
            
            {sale?.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span className="font-medium">
                  Discount {sale?.discount_type === 'percentage' ? `(${sale?.discount_value}%)` : ''}:
                </span>
                <span>-{formatCurrency(sale.discount_amount)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
              <span>{isReturn ? 'Return Amount:' : 'Total Amount:'}</span>
              <span className={isReturn ? 'text-orange-600' : 'text-green-600'}>
                {formatCurrency(Math.abs(sale?.total_amount || 0))}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="font-medium">Payment Method:</span>
              <span className="capitalize">{sale?.payment_method || 'Cash'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
        <p className="mb-2">Thank you for your business!</p>
        <p>Please keep this receipt for your records</p>
        {isReturn && (
          <p className="text-orange-600 font-medium mt-2">
            Returns must be accompanied by this receipt
          </p>
        )}
        <div className="mt-4 text-xs text-gray-500">
          <p>Generated on {formatDate(new Date())}</p>
          <p>MediPOS RMS - Pharmacy Management System</p>
        </div>
      </div>
    </div>
  );
});

Invoice.displayName = 'Invoice';

export default Invoice;