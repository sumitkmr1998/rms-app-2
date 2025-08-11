import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, Eye, Download, RefreshCw } from 'lucide-react';

const TallyImport = ({ onClose, onImportComplete }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Preview, 3: Import, 4: Results
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [validationStrict, setValidationStrict] = useState(true);
  
  // Results
  const [importResults, setImportResults] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const fileInputRef = useRef(null);
  
  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.csv', '.xlsx', '.xls', '.xml'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        showMessage('Please select a valid file type (CSV, Excel, or XML)', 'error');
        return;
      }
      
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showMessage('File size should be less than 10MB', 'error');
        return;
      }
      
      setSelectedFile(file);
      setCurrentStep(1);
    }
  };

  const uploadAndPreview = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setMessage('');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/tally/upload-preview`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }
      
      const previewResult = await response.json();
      setPreviewData(previewResult);
      setCurrentStep(2);
      
    } catch (error) {
      console.error('Upload error:', error);
      showMessage(error.message || 'File upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const startImport = async () => {
    if (!selectedFile || !previewData) return;
    
    setImporting(true);
    setImportProgress(0);
    setMessage('');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('duplicate_handling', duplicateHandling);
      formData.append('validation_strict', validationStrict.toString());
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/tally/import`, {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Import failed');
      }
      
      const importResult = await response.json();
      setImportResults(importResult);
      setCurrentStep(4);
      
      if (importResult.success) {
        showMessage(`Import completed successfully! ${importResult.imported} medicines imported.`, 'success');
        if (onImportComplete) {
          onImportComplete(importResult);
        }
      } else {
        showMessage(`Import completed with ${importResult.errors} errors.`, 'warning');
      }
      
    } catch (error) {
      console.error('Import error:', error);
      showMessage(error.message || 'Import failed', 'error');
      setCurrentStep(2); // Go back to preview
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const resetImport = () => {
    setCurrentStep(1);
    setSelectedFile(null);
    setPreviewData(null);
    setImportResults(null);
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      valid: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    return <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Tally Backup Data
          </DialogTitle>
          <DialogDescription>
            Import medicine inventory data from Tally backup files (CSV, Excel, or XML)
          </DialogDescription>
        </DialogHeader>

        {/* Message Display */}
        {message && (
          <Alert className={messageType === 'error' ? 'bg-red-50 border-red-200' : messageType === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}>
            <AlertDescription className={messageType === 'error' ? 'text-red-700' : messageType === 'warning' ? 'text-yellow-700' : 'text-green-700'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Choose Tally Backup File</h3>
              <p className="text-slate-600 mb-4">
                Select a CSV, Excel (.xlsx/.xls), or XML file exported from Tally
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="mb-4"
              >
                <FileText className="w-4 h-4 mr-2" />
                Select File
              </Button>
              
              {selectedFile && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium text-slate-900">{selectedFile.name}</p>
                        <p className="text-sm text-slate-600">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setSelectedFile(null)}
                      variant="ghost"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Supported File Formats:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>CSV:</strong> Comma-separated values with headers</li>
                <li>• <strong>Excel:</strong> .xlsx or .xls files with data in first sheet</li>
                <li>• <strong>XML:</strong> Tally XML export files with stock item data</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={uploadAndPreview}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Data
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview Data */}
        {currentStep === 2 && previewData && (
          <div className="space-y-6">
            {/* Import Statistics */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{previewData.total_records}</p>
                    <p className="text-sm text-slate-600">Total Records</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{previewData.valid_records}</p>
                    <p className="text-sm text-slate-600">Valid</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">{previewData.total_records - previewData.valid_records - previewData.invalid_records}</p>
                    <p className="text-sm text-slate-600">Warnings</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{previewData.invalid_records}</p>
                    <p className="text-sm text-slate-600">Errors</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {previewData.duplicates_found > 0 && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-yellow-700">
                  Found {previewData.duplicates_found} medicines that already exist in your database.
                  Choose how to handle duplicates below.
                </AlertDescription>
              </Alert>
            )}

            {/* Import Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Import Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Duplicate Handling</Label>
                  <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip - Don't import duplicates</SelectItem>
                      <SelectItem value="merge">Merge - Update with new non-empty values</SelectItem>
                      <SelectItem value="overwrite">Overwrite - Replace existing data completely</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-600">
                    {duplicateHandling === 'skip' && 'Existing medicines will remain unchanged'}
                    {duplicateHandling === 'merge' && 'Only non-empty fields from import will update existing data'}
                    {duplicateHandling === 'overwrite' && 'All existing data will be replaced with import data'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Data Preview Table */}
            <Card>
              <CardHeader>
                <CardTitle>Data Preview (First 10 records)</CardTitle>
                <CardDescription>
                  Review the imported data before proceeding with the import
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Status</th>
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Medicine Name</th>
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Price</th>
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Stock</th>
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Supplier</th>
                        <th className="border border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-700">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.medicines.slice(0, 10).map((medicine, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-2">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(medicine.status)}
                              {getStatusBadge(medicine.status)}
                            </div>
                          </td>
                          <td className="border border-slate-200 px-2 py-2 font-medium">
                            {medicine.name || 'N/A'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2">
                            ₹{medicine.price?.toFixed(2) || '0.00'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2">
                            {medicine.stock_quantity || 0}
                          </td>
                          <td className="border border-slate-200 px-2 py-2">
                            {medicine.supplier || 'N/A'}
                          </td>
                          <td className="border border-slate-200 px-2 py-2">
                            {medicine.issues.length > 0 ? (
                              <div className="text-xs text-slate-600">
                                {medicine.issues.slice(0, 2).map((issue, i) => (
                                  <div key={i}>{issue}</div>
                                ))}
                                {medicine.issues.length > 2 && <div>+{medicine.issues.length - 2} more</div>}
                              </div>
                            ) : (
                              <span className="text-xs text-green-600">No issues</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {previewData.medicines.length > 10 && (
                    <div className="mt-2 text-sm text-slate-600 text-center">
                      Showing 10 of {previewData.medicines.length} records
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetImport}>
                Back to Upload
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={startImport}
                  disabled={previewData.valid_records === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Import {previewData.valid_records} Medicine{previewData.valid_records !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {currentStep === 3 && (
          <div className="space-y-6 text-center py-8">
            <RefreshCw className="w-16 h-16 text-blue-600 mx-auto animate-spin" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Importing Data...</h3>
              <p className="text-slate-600 mb-4">Please wait while we import your medicine data</p>
              
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} className="mb-2" />
                <p className="text-sm text-slate-600">{importProgress}% complete</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === 4 && importResults && (
          <div className="space-y-6">
            <div className="text-center">
              {importResults.success ? (
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              ) : (
                <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
              )}
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {importResults.success ? 'Import Completed Successfully!' : 'Import Completed with Issues'}
              </h3>
            </div>

            {/* Results Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{importResults.total_processed}</p>
                  <p className="text-sm text-slate-600">Total Processed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResults.imported}</p>
                  <p className="text-sm text-slate-600">Imported</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importResults.skipped}</p>
                  <p className="text-sm text-slate-600">Skipped</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{importResults.errors}</p>
                  <p className="text-sm text-slate-600">Errors</p>
                </CardContent>
              </Card>
            </div>

            {importResults.duplicates_handled > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-700">
                  {importResults.duplicates_handled} duplicate medicine{importResults.duplicates_handled !== 1 ? 's' : ''} 
                  {duplicateHandling === 'skip' ? ' were skipped' : 
                   duplicateHandling === 'merge' ? ' were merged' : ' were overwritten'}.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Details */}
            {importResults.error_details && importResults.error_details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Error Details</CardTitle>
                  <CardDescription>
                    Issues encountered during import
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {importResults.error_details.map((error, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-200">
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-red-900">Row {error.row}: {error.name}</p>
                          <p className="text-red-700">
                            {error.issues ? error.issues.join(', ') : error.error}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImport}>
                Import Another File
              </Button>
              <Button onClick={onClose} className="bg-green-600 hover:bg-green-700">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TallyImport;