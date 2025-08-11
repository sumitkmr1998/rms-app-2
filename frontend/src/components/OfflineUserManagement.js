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
import { Trash2, Edit2, Plus, Users, Shield, Eye, Download, Upload, Database } from 'lucide-react';
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
      case 'admin': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'manager': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cashier': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Card className="max-w-md bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Shield className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400 text-center">You don't have permission to access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-white">User Management</h1>
              <p className="text-slate-400">Manage offline user database</p>
            </div>
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
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('import-file').click()}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {message && (
          <Alert className={messageType === 'error' ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/10 border-green-500/50'}>
            <AlertDescription className={messageType === 'error' ? 'text-red-400' : 'text-green-400'}>
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
            />
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add a new user to the offline database
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username *</Label>
                    <Input
                      value={userForm.username}
                      onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                      className="bg-slate-700 border-slate-600"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={userForm.fullName}
                      onChange={(e) => setUserForm({...userForm, fullName: e.target.value})}
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={userForm.phone}
                    onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
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
                      className="bg-slate-700 border-slate-600"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <Input
                      type="password"
                      value={userForm.confirmPassword}
                      onChange={(e) => setUserForm({...userForm, confirmPassword: e.target.value})}
                      className="bg-slate-700 border-slate-600"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      resetForm();
                    }}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users List */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{user.fullName || user.username}</h3>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                        {!user.isActive && (
                          <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-slate-400">@{user.username}</p>
                        {user.email && <p className="text-sm text-slate-400">{user.email}</p>}
                        {user.phone && <p className="text-sm text-slate-400">{user.phone}</p>}
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
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {user.id !== currentUser.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredUsers.length === 0 && (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Database className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400 text-center">
                  {searchTerm ? 'No users found matching your search' : 'No users found'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update user information
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username *</Label>
                  <Input
                    value={userForm.username}
                    onChange={(e) => setUserForm({...userForm, username: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({...userForm, fullName: e.target.value})}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={userForm.phone}
                  onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={userForm.role} onValueChange={(value) => setUserForm({...userForm, role: value})}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedUser(null);
                    resetForm();
                  }}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default OfflineUserManagement;