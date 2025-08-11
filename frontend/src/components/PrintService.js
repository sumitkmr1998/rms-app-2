// PrintService.js - Utility service for handling different printing methods

class PrintService {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('printerSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      defaultPrinter: 'browser_default',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: 'default',
      autoPrint: false,
      printType: 'invoice',
      receiptWidth: '80mm',
      printPreview: true
    };
  }

  async printInvoice(invoiceContent, options = {}) {
    const settings = { ...this.settings, ...options };
    
    try {
      if (settings.printPreview && !options.skipPreview) {
        return this.printWithPreview(invoiceContent, settings);
      } else {
        return this.printDirect(invoiceContent, settings);
      }
    } catch (error) {
      console.error('Print error:', error);
      throw new Error('Printing failed: ' + error.message);
    }
  }

  printWithPreview(content, settings) {
    return new Promise((resolve, reject) => {
      try {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (!printWindow) {
          reject(new Error('Unable to open print preview. Please allow popups.'));
          return;
        }

        const htmlContent = this.generatePrintHTML(content, settings);
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Add print and close buttons to preview
        const controls = printWindow.document.createElement('div');
        controls.innerHTML = `
          <div style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: white; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <button id="printBtn" style="margin-right: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">🖨️ Print</button>
            <button id="closeBtn" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">✖️ Close</button>
          </div>
        `;
        
        printWindow.document.body.appendChild(controls);

        // Add event listeners
        printWindow.document.getElementById('printBtn').onclick = () => {
          printWindow.print();
          resolve(true);
        };

        printWindow.document.getElementById('closeBtn').onclick = () => {
          printWindow.close();
          resolve(false);
        };

        // Handle window close
        printWindow.onbeforeunload = () => {
          resolve(false);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  printDirect(content, settings) {
    return new Promise((resolve, reject) => {
      try {
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
          reject(new Error('Unable to open print window. Please allow popups.'));
          return;
        }

        const htmlContent = this.generatePrintHTML(content, settings);
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load, then print
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          resolve(true);
        }, 500);

      } catch (error) {
        reject(error);
      }
    });
  }

  generatePrintHTML(content, settings) {
    const paperSize = this.getPaperSizeCss(settings.paperSize);
    const margins = this.getMarginsCss(settings.margins);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>MediPOS Print</title>
          <meta charset="utf-8">
          <style>
            @media print {
              body { 
                margin: 0; 
                font-size: ${settings.paperSize === 'Receipt' ? '12px' : '14px'};
              }
              @page { 
                size: ${paperSize}; 
                orientation: ${settings.orientation};
                margin: ${margins};
              }
              .no-print { display: none !important; }
            }
            
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.4;
              color: #333;
            }
            
            .invoice-print {
              max-width: ${settings.paperSize === 'Receipt' ? '80mm' : '100%'};
              margin: 0 auto;
              padding: ${settings.paperSize === 'Receipt' ? '10px' : '20px'};
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            
            th, td {
              padding: ${settings.paperSize === 'Receipt' ? '4px' : '8px'};
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            
            th {
              background-color: #f8f9fa;
              font-weight: bold;
            }
            
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border-t { border-top: 2px solid #333; }
            .border-b { border-bottom: 2px solid #333; }
            
            h1 { 
              font-size: ${settings.paperSize === 'Receipt' ? '18px' : '24px'}; 
              margin: 10px 0;
            }
            h2 { 
              font-size: ${settings.paperSize === 'Receipt' ? '16px' : '20px'}; 
              margin: 8px 0;
            }
            h3 { 
              font-size: ${settings.paperSize === 'Receipt' ? '14px' : '16px'}; 
              margin: 6px 0;
            }
            
            ${settings.paperSize === 'Receipt' ? `
              .invoice-print { font-size: 12px; }
              table { font-size: 11px; }
              .receipt-compact { margin: 2px 0; }
            ` : ''}
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `;
  }

  getPaperSizeCss(paperSize) {
    const sizes = {
      'A4': 'A4',
      'A5': 'A5',
      'Letter': 'letter',
      'Legal': 'legal',
      'Receipt': '80mm 200mm'
    };
    return sizes[paperSize] || 'A4';
  }

  getMarginsCss(margins) {
    const marginValues = {
      'narrow': '0.5in',
      'default': '0.75in',
      'wide': '1in'
    };
    return marginValues[margins] || '0.75in';
  }

  // Utility method to check if printing is supported
  isPrintingSupported() {
    return 'print' in window;
  }

  // Method to get printer capabilities (if supported by browser)
  async getPrinterCapabilities() {
    try {
      if ('queryLocalFonts' in window) {
        // Check for advanced printing capabilities
        return {
          advancedPrinting: true,
          fonts: await window.queryLocalFonts(),
        };
      }
      return { advancedPrinting: false };
    } catch (error) {
      return { advancedPrinting: false };
    }
  }

  // Method for thermal receipt printing
  printThermalReceipt(content, width = '80mm') {
    const thermalSettings = {
      ...this.settings,
      paperSize: 'Receipt',
      receiptWidth: width,
      margins: 'narrow'
    };
    
    return this.printInvoice(content, thermalSettings);
  }
}

export default PrintService;