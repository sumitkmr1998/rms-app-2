import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Printer, Settings, RefreshCw, TestTube2, RotateCcw, Check, AlertCircle, Info } from 'lucide-react';

const PrinterSettings = () => {
  const [printerSettings, setPrinterSettings] = useState({
    defaultPrinter: '',
    paperSize: 'A4',
    orientation: 'portrait',
    margins: 'default',
    autoPrint: false,
    printType: 'invoice',
    receiptWidth: '80mm',
    printPreview: true
  });

  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
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

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const detectPrinters = async () => {
    setLoading(true);
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

      setAvailablePrinters(printers);
      showMessage(`Detected ${printers.length} printer(s)`, 'success');
    } catch (error) {
      console.error('Error detecting printers:', error);
      showMessage('Limited printer detection available. Using browser defaults.', 'info');
      
      // Fallback to basic options
      setAvailablePrinters([
        { id: 'browser_default', name: 'Browser Default Printer', type: 'browser' },
        { id: 'system_default', name: 'System Default Printer', type: 'system' }
      ]);
    }
    
    setLoading(false);
  };

  const saveSettings = () => {
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    showMessage('Printer settings saved successfully', 'success');
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
      
      showMessage('Test print sent successfully', 'success');
    } catch (error) {
      console.error('Test print error:', error);
      showMessage('Test print failed', 'error');
    }
    
    setTestPrinting(false);
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
    showMessage('Settings reset to defaults', 'success');
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'browser': return 'bg-blue-100 text-blue-800';
      case 'system': return 'bg-green-100 text-green-800';
      case 'usb': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Printer Settings</h2>
        <p className="text-slate-600">Configure printing options for receipts and invoices</p>
      </div>

      {/* Message Display */}
      {message && (
        <Alert className={
          messageType === 'error' ? 'border-red-200 bg-red-50' :
          messageType === 'info' ? 'border-blue-200 bg-blue-50' :
          'border-green-200 bg-green-50'
        }>
          {messageType === 'error' ? <AlertCircle className="w-4 h-4" /> :
           messageType === 'info' ? <Info className="w-4 h-4" /> :
           <Check className="w-4 h-4" />}
          <AlertDescription className={
            messageType === 'error' ? 'text-red-700' :
            messageType === 'info' ? 'text-blue-700' :
            'text-green-700'
          }>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Printer Detection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Available Printers
              </CardTitle>
              <CardDescription>
                Detected printers on your system
              </CardDescription>
            </div>
            <Button 
              onClick={detectPrinters}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Detecting...' : 'Detect Printers'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {availablePrinters.length > 0 ? (
            <div className="space-y-3">
              {availablePrinters.map((printer) => (
                <div key={printer.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Printer className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{printer.name}</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(printer.type)}`}>
                          {printer.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Printer className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">No printers detected</h4>
              <p className="text-slate-600 mb-4">Click "Detect Printers" to scan for available printers</p>
              <Button onClick={detectPrinters} disabled={loading} variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Detect Printers
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Print Configuration
          </CardTitle>
          <CardDescription>
            Configure your print settings and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paper Size */}
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select 
                value={printerSettings.paperSize} 
                onValueChange={(value) => setPrinterSettings({...printerSettings, paperSize: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="A5">A5 (148 × 210 mm)</SelectItem>
                  <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                  <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                  <SelectItem value="Receipt">Receipt (80mm width)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select 
                value={printerSettings.orientation} 
                onValueChange={(value) => setPrinterSettings({...printerSettings, orientation: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Margins */}
            <div className="space-y-2">
              <Label>Margins</Label>
              <Select 
                value={printerSettings.margins} 
                onValueChange={(value) => setPrinterSettings({...printerSettings, margins: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">Narrow (0.5 inch)</SelectItem>
                  <SelectItem value="default">Default (0.75 inch)</SelectItem>
                  <SelectItem value="wide">Wide (1 inch)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Print Type */}
            <div className="space-y-2">
              <Label>Default Print Type</Label>
              <Select 
                value={printerSettings.printType} 
                onValueChange={(value) => setPrinterSettings({...printerSettings, printType: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice (Detailed)</SelectItem>
                  <SelectItem value="receipt">Receipt (Compact)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Additional Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Additional Options</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-print after completing sale</Label>
                  <p className="text-sm text-slate-600">Automatically print receipts without confirmation</p>
                </div>
                <Switch
                  checked={printerSettings.autoPrint}
                  onCheckedChange={(checked) => setPrinterSettings({...printerSettings, autoPrint: checked})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Show print preview</Label>
                  <p className="text-sm text-slate-600">Display preview before printing</p>
                </div>
                <Switch
                  checked={printerSettings.printPreview}
                  onCheckedChange={(checked) => setPrinterSettings({...printerSettings, printPreview: checked})}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveSettings} className="flex-1">
              <Check className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
            
            <Button 
              onClick={testPrint}
              disabled={testPrinting}
              variant="outline"
              className="flex-1"
            >
              <TestTube2 className={`w-4 h-4 mr-2 ${testPrinting ? 'animate-pulse' : ''}`} />
              {testPrinting ? 'Testing...' : 'Test Print'}
            </Button>
            
            <Button 
              onClick={resetToDefaults}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Defaults
            </Button>
          </div>

          {/* Usage Instructions */}
          <Alert className="mt-6">
            <Info className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p><strong>Usage Tips:</strong></p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Select your preferred printer from the detected list</li>
                  <li>Configure paper size and orientation based on your printer</li>
                  <li>Use "Receipt" format for thermal printers or compact printing</li>
                  <li>Enable auto-print for faster checkout process</li>
                  <li>Test print to verify settings before going live</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrinterSettings;