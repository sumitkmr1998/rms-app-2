import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, Edit2, Plus, Users, Shield, Download, Upload, UserPlus, Search, AlertCircle, Check, Info } from 'lucide-react';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';

const OfflineUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'cashier',
    isActive: true
  });

  const { user: currentUser, getAllUsers, createUser, updateUser, deleteUser, exportData, importData } = useOfflineAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const result = getAllUsers();
    if (result.success) {
      setUsers(result.users);
    } else {
      showMessage(result.error, 'error');
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const resetForm = () => {
    setUserForm({
      username: '',
      email: '',
      fullName: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'cashier',
      isActive: true
    });
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    setLoading(true);

    if (userForm.password !== userForm.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      setLoading(false);
      return;
    }

    const userData = {
      username: userForm.username,
      email: userForm.email || null,
      fullName: userForm.fullName || null,
      phone: userForm.phone || null,
      password: userForm.password,
      role: userForm.role,
      isActive: userForm.isActive
    };

    const result = createUser(userData);
    
    if (result.success) {
      showMessage('User created successfully', 'success');
      setShowCreateDialog(false);
      resetForm();
      loadUsers();
    } else {
      showMessage(result.error, 'error');
    }
    
    setLoading(false);
  };

  const handleEditUser = (e) => {
    e.preventDefault();
    setLoading(true);

    const updateData = {
      username: userForm.username,
      email: userForm.email || null,
      fullName: userForm.fullName || null,
      phone: userForm.phone || null,
      role: userForm.role,
      isActive: userForm.isActive
    };

    const result = updateUser(selectedUser.id, updateData);
    
    if (result.success) {
      showMessage('User updated successfully', 'success');
      setShowEditDialog(false);
      setSelectedUser(null);
      resetForm();
      loadUsers();
    } else {
      showMessage(result.error, 'error');
    }
    
    setLoading(false);
  };

  const handleDeleteUser = (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    const result = deleteUser(userId);
    
    if (result.success) {
      showMessage('User deleted successfully', 'success');
      loadUsers();
    } else {
      showMessage(result.error, 'error');
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      email: user.email || '',
      fullName: user.fullName || '',
      phone: user.phone || '',
      password: '',
      confirmPassword: '',
      role: user.role,
      isActive: user.isActive
    });
    setShowEditDialog(true);
  };

  const handleExportData = () => {
    const data = exportData();
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medipos-users-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('User data exported successfully', 'success');
    }
  };

  const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const success = importData(data);
        if (success) {
          showMessage('User data imported successfully', 'success');
          loadUsers();
        } else {
          showMessage('Failed to import data', 'error');
        }
      } catch (error) {
        showMessage('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cashier': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusBadgeColor = (isActive) => {
    return isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200';
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Shield className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600 text-center">You don't have permission to access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">User Management</h2>
          <p className="text-slate-600">Manage system users and their permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImportData}
            className="hidden"
            id="import-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('import-file').click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
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

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                System Users
              </CardTitle>
              <CardDescription>
                {users.length} total users • {users.filter(u => u.isActive).length} active
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system with appropriate permissions
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username *</Label>
                      <Input
                        value={userForm.username}
                        onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={userForm.fullName}
                        onChange={(e) => setUserForm({...userForm, fullName: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={userForm.phone}
                        onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password *</Label>
                      <Input
                        type="password"
                        value={userForm.confirmPassword}
                        onChange={(e) => setUserForm({...userForm, confirmPassword: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateDialog(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>
            All registered users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">
                {searchTerm ? 'No users found' : 'No users yet'}
              </h4>
              <p className="text-slate-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Create your first user to get started'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create First User
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <div key={user.id} className="py-4 hover:bg-slate-50 transition-colors rounded-lg px-4 -mx-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {user.fullName || user.username}
                          </h4>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                          <Badge className={getStatusBadgeColor(user.isActive)}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-600">@{user.username}</p>
                          {user.email && (
                            <p className="text-sm text-slate-600">{user.email}</p>
                          )}
                          {user.phone && (
                            <p className="text-sm text-slate-600">{user.phone}</p>
                          )}
                          {user.lastLogin && (
                            <p className="text-xs text-slate-500">
                              Last login: {new Date(user.lastLogin).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {user.id !== currentUser.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            User Management Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">1</div>
              <div>
                <p className="font-medium text-slate-900">Role Permissions</p>
                <p className="text-sm text-slate-600">Admin: Full access • Manager: Inventory & Reports • Cashier: POS only</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">2</div>
              <div>
                <p className="font-medium text-slate-900">Password Security</p>
                <p className="text-sm text-slate-600">Use strong passwords and update them regularly</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600 mt-0.5">3</div>
              <div>
                <p className="font-medium text-slate-900">Data Management</p>
                <p className="text-sm text-slate-600">Export user data for backup and import when needed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={userForm.username}
                  onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({...userForm, fullName: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={userForm.phone}
                  onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedUser(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OfflineUserManagement;