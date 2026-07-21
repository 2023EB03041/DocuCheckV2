import React, { useState } from 'react';
import axios from 'axios';
import { Lock, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const StaffLogin = ({ onLogin }) => {
  const [loginType, setLoginType] = useState('Manager');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password, loginType });
      
      // Save token and user details to localStorage
      localStorage.setItem('staffToken', res.data.token);
      localStorage.setItem('staffUser', JSON.stringify(res.data.user));
      
      // Inform parent component
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbf9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-sm shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#1a365d] rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#d4af37]" />
            </div>
          </div>
          <h2 className="text-3xl font-serif text-[#1a365d]">Staff Portal</h2>
          <p className="text-gray-500 mt-2 text-sm uppercase tracking-wider">Authorized Personnel Only</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-sm mb-6">
          <button 
            type="button"
            onClick={() => { setLoginType('Manager'); setError(''); }}
            className={`flex-1 py-2 text-sm font-bold tracking-wider uppercase rounded-sm transition-colors ${loginType === 'Manager' ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Manager
          </button>
          <button 
            type="button"
            onClick={() => { setLoginType('Superuser'); setError(''); }}
            className={`flex-1 py-2 text-sm font-bold tracking-wider uppercase rounded-sm transition-colors ${loginType === 'Superuser' ? 'bg-[#1a365d] shadow-sm text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Superuser
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 mb-6 rounded-sm text-sm border border-red-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a365d] text-white py-4 rounded-sm font-bold tracking-widest uppercase hover:bg-[#2a4365] transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StaffLogin;
