import React, { useState, useEffect } from 'react';
import { Calendar, User, Phone, MapPin, Plus, Edit, Trash2, CreditCard, Stethoscope, FileText, Filter, TrendingUp } from 'lucide-react';

const PatientManagement = () => {
  // State for patients
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showEditPatient, setShowEditPatient] = useState(false);
  
  // State for visits
  const [visits, setVisits] = useState([]);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showEditVisit, setShowEditVisit] = useState(false);
  
  // State for fee settings
  const [feeSettings, setFeeSettings] = useState({
    consultation_fee: 100.0,
    procedures: []
  });
  const [showFeeSettings, setShowFeeSettings] = useState(false);
  
  // State for analytics
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Form states
  const [patientForm, setPatientForm] = useState({
    name: '',
    phone: '',
    address: '',
    date_of_birth: '',
    gender: ''
  });
  
  const [visitForm, setVisitForm] = useState({
    patient_id: '',
    service_type: 'consultation',
    procedure_name: '',
    fee_amount: 0,
    payment_method: 'cash',
    notes: ''
  });
  
  const [newProcedure, setNewProcedure] = useState({
    name: '',
    fee: 0,
    description: ''
  });
  
  // Loading and message states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('patients'); // 'patients', 'visits', 'analytics', 'settings'

  // API utility function
  const makeApiCall = async (endpoint, options = {}) => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    const response = await fetch(`${backendUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }
    
    return response.json();
  };

  // Fetch data functions
  const fetchPatients = async (search = '') => {
    try {
      const data = await makeApiCall(`/api/patients${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setPatients(data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setMessage('Error fetching patients');
    }
  };

  const fetchVisits = async () => {
    try {
      let endpoint = '/api/patients/visits';
      const params = new URLSearchParams();
      
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.append('start_date', customStartDate);
        params.append('end_date', customEndDate);
      } else if (dateRange !== 'all') {
        params.append('date_range', dateRange);
      }
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }
      
      const data = await makeApiCall(endpoint);
      setVisits(data.visits || []);
    } catch (error) {
      console.error('Error fetching visits:', error);
      setMessage('Error fetching visits');
    }
  };

  const fetchFeeSettings = async () => {
    try {
      const data = await makeApiCall('/api/patients/fee-settings');
      setFeeSettings(data);
    } catch (error) {
      console.error('Error fetching fee settings:', error);
      setMessage('Error fetching fee settings');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const requestData = { date_range: dateRange };
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        requestData.start_date = customStartDate;
        requestData.end_date = customEndDate;
        delete requestData.date_range;
      }
      
      const data = await makeApiCall('/api/patients/analytics', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setMessage('Error fetching analytics');
    }
  };

  // Initialize data
  useEffect(() => {
    fetchPatients();
    fetchFeeSettings();
    fetchVisits();
    fetchAnalytics();
  }, []);

  // Update data when date range changes
  useEffect(() => {
    if (activeTab === 'visits' || activeTab === 'analytics') {
      fetchVisits();
      fetchAnalytics();
    }
  }, [dateRange, customStartDate, customEndDate, activeTab]);

  // Search patients
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchPatients(patientSearch);
    }, 300);
    
    return () => clearTimeout(delayedSearch);
  }, [patientSearch]);

  // Patient CRUD operations
  const handleAddPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await makeApiCall('/api/patients', {
        method: 'POST',
        body: JSON.stringify(patientForm),
      });
      
      setShowAddPatient(false);
      resetPatientForm();
      fetchPatients();
      setMessage('Patient added successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error adding patient:', error);
      setMessage('Error adding patient');
    }
    
    setLoading(false);
  };

  const handleEditPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await makeApiCall(`/api/patients/${selectedPatient.id}`, {
        method: 'PUT',
        body: JSON.stringify(patientForm),
      });
      
      setShowEditPatient(false);
      setSelectedPatient(null);
      resetPatientForm();
      fetchPatients();
      setMessage('Patient updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating patient:', error);
      setMessage('Error updating patient');
    }
    
    setLoading(false);
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete ${patient.name}?`)) return;

    try {
      await makeApiCall(`/api/patients/${patient.id}`, {
        method: 'DELETE',
      });
      
      fetchPatients();
      setMessage('Patient deleted successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting patient:', error);
      setMessage('Error deleting patient');
    }
  };

  // Visit CRUD operations
  const handleAddVisit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await makeApiCall('/api/patients/visits', {
        method: 'POST',
        body: JSON.stringify(visitForm),
      });
      
      setShowAddVisit(false);
      resetVisitForm();
      fetchVisits();
      fetchAnalytics();
      setMessage('Visit added successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error adding visit:', error);
      setMessage('Error adding visit');
    }
    
    setLoading(false);
  };

  const handleEditVisit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await makeApiCall(`/api/patients/visits/${selectedVisit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          patient_id: visitForm.patient_id,
          service_type: visitForm.service_type,
          procedure_name: visitForm.procedure_name,
          fee_amount: visitForm.fee_amount,
          payment_method: visitForm.payment_method,
          notes: visitForm.notes
        }),
      });
      
      setShowEditVisit(false);
      setSelectedVisit(null);
      resetVisitForm();
      fetchVisits();
      fetchAnalytics();
      setMessage('Visit updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating visit:', error);
      setMessage('Error updating visit');
    }
    
    setLoading(false);
  };

  const handleDeleteVisit = async (visit) => {
    if (!window.confirm(`Are you sure you want to delete this visit?`)) return;

    try {
      await makeApiCall(`/api/patients/visits/${visit.id}`, {
        method: 'DELETE',
      });
      
      fetchVisits();
      fetchAnalytics();
      setMessage('Visit deleted successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting visit:', error);
      setMessage('Error deleting visit');
    }
  };

  // Fee settings operations
  const handleAddProcedure = () => {
    if (!newProcedure.name || newProcedure.fee <= 0) {
      setMessage('Please enter procedure name and valid fee');
      return;
    }

    const updatedProcedures = [...feeSettings.procedures, {
      id: Date.now().toString(),
      name: newProcedure.name,
      fee: parseFloat(newProcedure.fee),
      description: newProcedure.description
    }];

    setFeeSettings({
      ...feeSettings,
      procedures: updatedProcedures
    });

    setNewProcedure({ name: '', fee: 0, description: '' });
  };

  const handleRemoveProcedure = (procedureId) => {
    const updatedProcedures = feeSettings.procedures.filter(p => p.id !== procedureId);
    setFeeSettings({
      ...feeSettings,
      procedures: updatedProcedures
    });
  };

  const handleSaveFeeSettings = async () => {
    setLoading(true);
    setMessage('');

    try {
      await makeApiCall('/api/patients/fee-settings', {
        method: 'PUT',
        body: JSON.stringify(feeSettings),
      });
      
      setShowFeeSettings(false);
      setMessage('Fee settings updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating fee settings:', error);
      setMessage('Error updating fee settings');
    }
    
    setLoading(false);
  };

  // Helper functions
  const resetPatientForm = () => {
    setPatientForm({
      name: '',
      phone: '',
      address: '',
      date_of_birth: '',
      gender: ''
    });
  };

  const resetVisitForm = () => {
    setVisitForm({
      patient_id: '',
      service_type: 'consultation',
      procedure_name: '',
      fee_amount: 0,
      payment_method: 'cash',
      notes: ''
    });
  };

  const openEditPatient = (patient) => {
    setSelectedPatient(patient);
    setPatientForm({
      name: patient.name,
      phone: patient.phone,
      address: patient.address,
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || ''
    });
    setShowEditPatient(true);
  };

  const openAddVisit = (patient = null) => {
    if (patient) {
      setVisitForm({
        ...visitForm,
        patient_id: patient.id,
        fee_amount: feeSettings.consultation_fee
      });
    } else {
      setVisitForm({
        ...visitForm,
        fee_amount: feeSettings.consultation_fee
      });
    }
    setShowAddVisit(true);
  };

  const openEditVisit = (visit) => {
    setSelectedVisit(visit);
    setVisitForm({
      patient_id: visit.patient_id,
      service_type: visit.service_type,
      procedure_name: visit.procedure_name || '',
      fee_amount: visit.fee_amount,
      payment_method: visit.payment_method,
      notes: visit.notes || ''
    });
    setShowEditVisit(true);
  };

  const handleServiceTypeChange = (serviceType) => {
    let fee = 0;
    if (serviceType === 'consultation') {
      fee = feeSettings.consultation_fee;
    }
    
    setVisitForm({
      ...visitForm,
      service_type: serviceType,
      fee_amount: fee,
      procedure_name: serviceType === 'consultation' ? '' : visitForm.procedure_name
    });
  };

  const handleProcedureSelect = (procedureName) => {
    const procedure = feeSettings.procedures.find(p => p.name === procedureName);
    setVisitForm({
      ...visitForm,
      procedure_name: procedureName,
      fee_amount: procedure ? procedure.fee : 0
    });
  };

  // Render functions
  const renderPatientsList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">👥 Patient Management</h2>
        <button
          onClick={() => setShowAddPatient(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search patients by name, phone, or patient number..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
        />
      </div>

      {/* Patients List */}
      <div className="grid gap-4">
        {patients.map((patient) => (
          <div key={patient.id} className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <User className="text-blue-600" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                    {patient.patient_number}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Phone size={16} />
                    <span>{patient.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{patient.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>Added: {new Date(patient.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {patient.date_of_birth && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">DOB:</span> {new Date(patient.date_of_birth).toLocaleDateString()}
                    {patient.gender && <span className="ml-4 font-medium">Gender:</span>} {patient.gender}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAddVisit(patient)}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Stethoscope size={16} />
                  Add Visit
                </button>
                <button
                  onClick={() => openEditPatient(patient)}
                  className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePatient(patient)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {patients.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No patients found. Click "Add Patient" to get started.
        </div>
      )}
    </div>
  );

  const renderVisitsList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🏥 Patient Visits</h2>
        <button
          onClick={() => openAddVisit()}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Visit
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Filter size={20} />
          Date Range Filter
        </h3>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'this_month', label: 'This Month' },
              { value: 'all', label: 'All Time' },
              { value: 'custom', label: 'Custom Range' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visits List */}
      <div className="grid gap-4">
        {visits.map((visit) => (
          <div key={visit.id} className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Stethoscope className="text-green-600" size={20} />
                  <h3 className="text-lg font-semibold text-gray-900">{visit.patient_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    visit.service_type === 'consultation' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {visit.service_type === 'consultation' ? '💬 Consultation' : '🔧 Procedure'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{new Date(visit.visit_date).toLocaleDateString()}</span>
                  </div>
                  {visit.procedure_name && (
                    <div className="flex items-center gap-2">
                      <FileText size={16} />
                      <span>{visit.procedure_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} />
                    <span>₹{visit.fee_amount} ({visit.payment_method})</span>
                  </div>
                  <div className="text-sm">
                    <span>{new Date(visit.visit_date).toLocaleTimeString()}</span>
                  </div>
                </div>

                {visit.notes && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {visit.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditVisit(visit)}
                  className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Edit size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteVisit(visit)}
                  className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visits.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No visits found for the selected date range.
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">📊 Patient Analytics</h2>
        <span className="text-sm text-gray-600">
          {analytics?.period_label}
        </span>
      </div>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <User className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Patients</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.total_patients}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Stethoscope className="text-green-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Visits</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.total_visits}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <TrendingUp className="text-purple-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{analytics.total_revenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <CreditCard className="text-orange-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. per Visit</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{analytics.total_visits > 0 ? (analytics.total_revenue / analytics.total_visits).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Consultations</span>
                    <span className="text-sm text-gray-600">{analytics.consultations_count} visits</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: analytics.total_visits > 0 ? `${(analytics.consultations_count / analytics.total_visits) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">₹{analytics.consultation_revenue.toFixed(2)} revenue</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Procedures</span>
                    <span className="text-sm text-gray-600">{analytics.procedures_count} visits</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: analytics.total_visits > 0 ? `${(analytics.procedures_count / analytics.total_visits) * 100}%` : '0%' }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">₹{analytics.procedure_revenue.toFixed(2)} revenue</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Procedures</h3>
              <div className="space-y-3">
                {analytics.popular_procedures.slice(0, 5).map((procedure, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{procedure.name}</span>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">{procedure.count} times</span>
                      <p className="text-xs text-gray-500">₹{procedure.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {analytics.popular_procedures.length === 0 && (
                  <p className="text-sm text-gray-500">No procedures recorded</p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Visits Chart */}
          {analytics.daily_visits.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Visits</h3>
              <div className="space-y-2">
                {analytics.daily_visits.map((day, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">{new Date(day.date).toLocaleDateString()}</span>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">{day.visits} visits</span>
                      <p className="text-xs text-gray-500">₹{day.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderFeeSettings = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">⚙️ Fee Settings</h2>
        <button
          onClick={handleSaveFeeSettings}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Consultation Fee */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Consultation Fee</h3>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Consultation Fee (₹)
          </label>
          <input
            type="number"
            value={feeSettings.consultation_fee}
            onChange={(e) => setFeeSettings({
              ...feeSettings,
              consultation_fee: parseFloat(e.target.value) || 0
            })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="100"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Procedures */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Procedure Types & Fees</h3>
        
        {/* Add New Procedure */}
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h4 className="text-md font-medium text-gray-700 mb-3">Add New Procedure</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
              <input
                type="text"
                value={newProcedure.name}
                onChange={(e) => setNewProcedure({ ...newProcedure, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., X-Ray, Blood Test"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
              <input
                type="number"
                value={newProcedure.fee}
                onChange={(e) => setNewProcedure({ ...newProcedure, fee: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newProcedure.description}
                onChange={(e) => setNewProcedure({ ...newProcedure, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddProcedure}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={20} />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Existing Procedures */}
        <div className="space-y-3">
          <h4 className="text-md font-medium text-gray-700">Current Procedures</h4>
          {feeSettings.procedures.length > 0 ? (
            <div className="space-y-2">
              {feeSettings.procedures.map((procedure) => (
                <div key={procedure.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{procedure.name}</span>
                    <span className="text-green-600 font-semibold ml-3">₹{procedure.fee}</span>
                    {procedure.description && (
                      <p className="text-sm text-gray-600">{procedure.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveProcedure(procedure.id)}
                    className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No procedures added yet. Add procedures to enable quick fee selection.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Modal components
  const PatientModal = ({ isEdit = false }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isEdit ? 'Edit Patient' : 'Add New Patient'}
          </h3>
          
          <form onSubmit={isEdit ? handleEditPatient : handleAddPatient} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientForm.name}
                onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter patient name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={patientForm.phone}
                onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <textarea
                value={patientForm.address}
                onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter address"
                rows="3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={patientForm.date_of_birth}
                onChange={(e) => setPatientForm({ ...patientForm, date_of_birth: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                value={patientForm.gender}
                onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  isEdit ? setShowEditPatient(false) : setShowAddPatient(false);
                  resetPatientForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Patient' : 'Add Patient'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const VisitModal = ({ isEdit = false }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isEdit ? 'Edit Visit' : 'Add New Visit'}
          </h3>
          
          <form onSubmit={isEdit ? handleEditVisit : handleAddVisit} className="space-y-4">
            {/* Patient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <select
                value={visitForm.patient_id}
                onChange={(e) => setVisitForm({ ...visitForm, patient_id: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} - {patient.patient_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Service Type *
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleServiceTypeChange('consultation')}
                  className={`flex-1 p-4 border-2 rounded-lg text-center transition-colors ${
                    visitForm.service_type === 'consultation'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-2">💬</div>
                  <div className="font-medium">Consultation</div>
                  <div className="text-sm text-gray-600">₹{feeSettings.consultation_fee}</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleServiceTypeChange('procedure')}
                  className={`flex-1 p-4 border-2 rounded-lg text-center transition-colors ${
                    visitForm.service_type === 'procedure'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-medium">Procedure</div>
                  <div className="text-sm text-gray-600">Variable Fee</div>
                </button>
              </div>
            </div>

            {/* Procedure Selection */}
            {visitForm.service_type === 'procedure' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Procedure Type *
                </label>
                <select
                  value={visitForm.procedure_name}
                  onChange={(e) => handleProcedureSelect(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Procedure</option>
                  {feeSettings.procedures.map((procedure) => (
                    <option key={procedure.id} value={procedure.name}>
                      {procedure.name} - ₹{procedure.fee}
                    </option>
                  ))}
                </select>
                {feeSettings.procedures.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    No procedures configured. Please add procedures in Fee Settings.
                  </p>
                )}
              </div>
            )}

            {/* Fee Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fee Amount (₹) *
              </label>
              <input
                type="number"
                value={visitForm.fee_amount}
                onChange={(e) => setVisitForm({ ...visitForm, fee_amount: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                value={visitForm.payment_method}
                onChange={(e) => setVisitForm({ ...visitForm, payment_method: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={visitForm.notes}
                onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional notes..."
                rows="3"
              />
            </div>

            {/* Total Fee Display */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-green-800">Total Fee:</span>
                <span className="text-xl font-bold text-green-800">₹{visitForm.fee_amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  isEdit ? setShowEditVisit(false) : setShowAddVisit(false);
                  resetVisitForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Visit' : 'Add Visit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex">
            {[
              { id: 'patients', label: '👥 Patients', icon: User },
              { id: 'visits', label: '🏥 Visits', icon: Stethoscope },
              { id: 'analytics', label: '📊 Analytics', icon: TrendingUp },
              { id: 'settings', label: '⚙️ Fee Settings', icon: null }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') || message.includes('error')
              ? 'bg-red-100 border border-red-200 text-red-700'
              : 'bg-green-100 border border-green-200 text-green-700'
          }`}>
            {message}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'patients' && renderPatientsList()}
        {activeTab === 'visits' && renderVisitsList()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'settings' && renderFeeSettings()}

        {/* Modals */}
        {showAddPatient && <PatientModal />}
        {showEditPatient && <PatientModal isEdit={true} />}
        {showAddVisit && <VisitModal />}
        {showEditVisit && <VisitModal isEdit={true} />}
      </div>
    </div>
  );
};

export default PatientManagement;