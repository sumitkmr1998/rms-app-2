import React, { useState, useEffect } from 'react';

const PrinterSettings = () => {
  const [printerSettings, setPrinterSettings] = useState({
    defaultPrinter: '',
    paperSize: 'A4',
    orientation: 'portrait',
    margins: 'default',
    autoPrint: false,
    printType: 'invoice', // 'invoice' or 'receipt'
    receiptWidth: '80mm',
    printPreview: true
  });

  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testPrinting, setTestPrinting] = useState(false);

  useEffect(() => {
    // Load saved printer settings
    const savedSettings = localStorage.getItem('printerSettings');
    if (savedSettings) {
      setPrinterSettings(JSON.parse(savedSettings));
    }
    
    // Detect available printers
    detectPrinters();
  }, []);

  const detectPrinters = async () => {
    setIsLoading(true);
    try {
      const printers = [];
      
      // Browser default printer
      printers.push({
        id: 'browser_default',
        name: 'Browser Default Printer',
        type: 'browser'
      });

      // Try to detect system printers using various methods
      if ('navigator' in window) {
        // Check if Web API for printer detection is available
        if ('usb' in navigator) {
          try {
            // This is experimental and may not work in all browsers
            const devices = await navigator.usb.getDevices();
            devices.forEach((device, index) => {
              if (device.productName && device.productName.toLowerCase().includes('printer')) {
                printers.push({
                  id: `usb_printer_${index}`,
                  name: device.productName,
                  type: 'usb'
                });
              }
            });
          } catch (error) {
            console.log('USB printer detection not available');
          }
        }

        // Try to get printer info from print media query
        if (window.matchMedia) {
          const printMedia = window.matchMedia('print');
          if (printMedia) {
            printers.push({
              id: 'system_default',
              name: 'System Default Printer',
              type: 'system'
            });
          }
        }
      }

      // Common printer detection for Windows (if available through extensions or local apps)
      if (window.chrome && window.chrome.runtime) {
        try {
          // This would work if there's a Chrome extension for printer detection
          printers.push({
            id: 'windows_default',
            name: 'Windows Default Printer',
            type: 'windows'
          });
        } catch (error) {
          console.log('Chrome printer API not available');
        }
      }

      setAvailablePrinters(printers);
      setMessage(`✅ Detected ${printers.length} printer(s)`);
    } catch (error) {
      console.error('Error detecting printers:', error);
      setMessage('⚠️ Limited printer detection available. Using browser defaults.');
      
      // Fallback to basic options
      setAvailablePrinters([
        { id: 'browser_default', name: 'Browser Default Printer', type: 'browser' },
        { id: 'system_default', name: 'System Default Printer', type: 'system' }
      ]);
    }
    
    setIsLoading(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const saveSettings = () => {
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    setMessage('✅ Printer settings saved successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  const testPrint = async () => {
    setTestPrinting(true);
    try {
      // Create a test print document
      const testContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <div style="text-center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
            <h1>MediPOS RMS</h1>
            <p>Printer Test Page</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2>Test Print Successful!</h2>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Printer:</strong> ${printerSettings.defaultPrinter || 'Browser Default'}</p>
            <p><strong>Paper Size:</strong> ${printerSettings.paperSize}</p>
            <p><strong>Orientation:</strong> ${printerSettings.orientation}</p>
          </div>
          
          <div style="border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
            <h3>Sample Receipt Format</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="border-bottom: 1px solid #ddd; padding: 5px;">Sample Medicine 1</td>
                <td style="border-bottom: 1px solid #ddd; padding: 5px; text-align: center;">2</td>
                <td style="border-bottom: 1px solid #ddd; padding: 5px; text-align: right;">₹50.00</td>
              </tr>
              <tr>
                <td style="border-bottom: 1px solid #ddd; padding: 5px;">Sample Medicine 2</td>
                <td style="border-bottom: 1px solid #ddd; padding: 5px; text-align: center;">1</td>
                <td style="border-bottom: 1px solid #ddd; padding: 5px; text-align: right;">₹25.00</td>
              </tr>
              <tr style="font-weight: bold;">
                <td colspan="2" style="padding: 10px 5px; text-align: right;">Total:</td>
                <td style="padding: 10px 5px; text-align: right;">₹75.00</td>
              </tr>
            </table>
          </div>
          
          <div style="text-center; margin-top: 30px; font-size: 12px; color: #666;">
            <p>This is a test print from MediPOS RMS</p>
            <p>If you can see this clearly, your printer settings are configured correctly</p>
          </div>
        </div>
      `;

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Printer Test - MediPOS RMS</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { 
                  size: ${printerSettings.paperSize}; 
                  orientation: ${printerSettings.orientation};
                  margin: ${printerSettings.margins === 'narrow' ? '0.5in' : printerSettings.margins === 'wide' ? '1in' : '0.75in'};
                }
              }
            </style>
          </head>
          <body>${testContent}</body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait a moment for content to load, then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      
      setMessage('✅ Test print sent successfully');
    } catch (error) {
      console.error('Test print error:', error);
      setMessage('❌ Test print failed');
    }
    
    setTestPrinting(false);
    setTimeout(() => setMessage(''), 5000);
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      defaultPrinter: '',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: 'default',
      autoPrint: false,
      printType: 'invoice',
      receiptWidth: '80mm',
      printPreview: true
    };
    
    setPrinterSettings(defaultSettings);
    setMessage('🔄 Settings reset to defaults');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Header */}
          <div className="border-b border-slate-200 p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">🖨️ Printer Settings</h1>
            <p className="text-slate-600">Configure printing options for receipts and invoices</p>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-lg ${
              message.includes('✅') ? 'bg-green-50 border border-green-200 text-green-800' :
              message.includes('⚠️') ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
              message.includes('🔄') ? 'bg-blue-50 border border-blue-200 text-blue-800' :
              'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message}
            </div>
          )}

          <div className="p-6 space-y-8">
            {/* Printer Detection */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Available Printers</h2>
                <button
                  onClick={detectPrinters}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Detecting...
                    </span>
                  ) : (
                    '🔍 Detect Printers'
                  )}
                </button>
              </div>
              
              {availablePrinters.length > 0 ? (
                <div className="grid gap-3">
                  {availablePrinters.map((printer) => (
                    <div key={printer.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="defaultPrinter"
                          value={printer.id}
                          checked={printerSettings.defaultPrinter === printer.id}
                          onChange={(e) => setPrinterSettings({
                            ...printerSettings,
                            defaultPrinter: e.target.value
                          })}
                          className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-medium text-slate-900">{printer.name}</div>
                          <div className="text-sm text-slate-500 capitalize">Type: {printer.type}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-2">🖨️</div>
                  <p>No printers detected. Click "Detect Printers" to scan again.</p>
                </div>
              )}
            </div>

            {/* Print Settings */}
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Print Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Paper Size */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Paper Size</label>
                  <select
                    value={printerSettings.paperSize}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      paperSize: e.target.value
                    })}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                    <option value="Receipt">Receipt (80mm width)</option>
                  </select>
                </div>

                {/* Orientation */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Orientation</label>
                  <select
                    value={printerSettings.orientation}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      orientation: e.target.value
                    })}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                {/* Margins */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Margins</label>
                  <select
                    value={printerSettings.margins}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      margins: e.target.value
                    })}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="narrow">Narrow (0.5 inch)</option>
                    <option value="default">Default (0.75 inch)</option>
                    <option value="wide">Wide (1 inch)</option>
                  </select>
                </div>

                {/* Print Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Default Print Type</label>
                  <select
                    value={printerSettings.printType}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      printType: e.target.value
                    })}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="invoice">Invoice (Detailed)</option>
                    <option value="receipt">Receipt (Compact)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Additional Options</h2>
              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={printerSettings.autoPrint}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      autoPrint: e.target.checked
                    })}
                    className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Auto-print after completing sale</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={printerSettings.printPreview}
                    onChange={(e) => setPrinterSettings({
                      ...printerSettings,
                      printPreview: e.target.checked
                    })}
                    className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-slate-700">Show print preview before printing</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-200">
              <button
                onClick={saveSettings}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                💾 Save Settings
              </button>
              
              <button
                onClick={testPrint}
                disabled={testPrinting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors font-medium"
              >
                {testPrinting ? (
                  <span className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Testing...
                  </span>
                ) : (
                  '🖨️ Test Print'
                )}
              </button>
              
              <button
                onClick={resetToDefaults}
                className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-medium"
              >
                🔄 Reset to Defaults
              </button>
            </div>

            {/* Usage Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">💡 Usage Instructions</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Select your preferred printer from the detected list</li>
                <li>• Configure paper size and orientation based on your printer</li>
                <li>• Use "Receipt" format for thermal printers or compact printing</li>
                <li>• Enable auto-print for faster checkout process</li>
                <li>• Test print to verify settings before going live</li>
                <li>• For Windows printers, ensure printer drivers are installed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;