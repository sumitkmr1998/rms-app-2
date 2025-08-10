import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useOfflineAuth } from '../contexts/OfflineAuthContext';
import { ShieldCheck, Users, Eye, EyeOff, Wifi, WifiOff, Database, Key } from 'lucide-react';

const ModernLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const { login } = useOfflineAuth();

  // Demo accounts for quick access
  const demoAccounts = [
    { username: 'admin', password: 'admin123', role: 'Administrator', color: 'bg-red-500' },
    { username: 'manager', password: 'manager123', role: 'Manager', color: 'bg-blue-500' },
    { username: 'cashier', password: 'cashier123', role: 'Cashier', color: 'bg-green-500' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password, rememberMe);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleDemoLogin = async (demoUser) => {
    setLoading(true);
    setError('');
    
    const result = await login(demoUser.username, demoUser.password, rememberMe);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  // Auto-fill demo credentials
  const handleDemoSelect = (demoUser) => {
    setUsername(demoUser.username);
    setPassword(demoUser.password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-2xl">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MediPOS RMS</h1>
          <p className="text-slate-400">Retail Management System - Offline Mode</p>
          
          {/* Offline Status */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <WifiOff className="w-4 h-4 text-green-400" />
            <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">
              <Database className="w-3 h-3 mr-1" />
              Offline Ready
            </Badge>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">Sign In</CardTitle>
            <CardDescription className="text-center text-slate-400">
              Access your pharmacy management system
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {error && (
              <Alert className="bg-red-500/10 border-red-500/50">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                    className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="remember" className="text-sm text-slate-300">
                    Remember me for 30 days
                  </Label>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2.5 transition-all duration-300 shadow-lg hover:shadow-xl"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </div>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <Separator className="bg-slate-600" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Demo Accounts</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDemo(!showDemo)}
                  className="text-slate-400 hover:text-white h-6 px-2"
                >
                  {showDemo ? 'Hide' : 'Show'}
                </Button>
              </div>

              {showDemo && (
                <div className="space-y-2">
                  {demoAccounts.map((demo) => (
                    <div key={demo.username} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
                      <div className={`w-3 h-3 rounded-full ${demo.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{demo.username}</span>
                          <Badge variant="outline" className="text-xs border-slate-500 text-slate-400">
                            {demo.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">Password: {demo.password}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDemoSelect(demo)}
                          className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                        >
                          Fill
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDemoLogin(demo)}
                          disabled={loading}
                          className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Login
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-sm">
            Complete pharmacy POS & inventory management system
          </p>
          <div className="flex items-center justify-center gap-1 text-xs text-slate-600">
            <Database className="w-3 h-3" />
            <span>Works completely offline • No internet required</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernLogin;