import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, LogIn, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { isLoggedIn, walletAddress, logout, login, isConnecting } = useAuth();

  // ✅ FIXED: Handle logout without page reload
  const handleLogout = () => {
    logout(true); // Show success toast
  };

  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-6">MythosNet</h2>
        
        {/* Wallet Status */}
        {isLoggedIn && walletAddress && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center mb-2">
              <Wallet className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-800">Connected</span>
            </div>
            <p className="text-xs text-green-700 font-mono">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          </div>
        )}

        <nav className="space-y-4">
          <Link to="/dashboard" className="block text-gray-700 hover:text-indigo-600">
            Dashboard
          </Link>
          <Link to="/blockchains" className="block text-gray-700 hover:text-indigo-600">
            Blockchains
          </Link>
          <Link to="/users" className="block text-gray-700 hover:text-indigo-600">
            Users
          </Link>
          <Link to="/invoices" className="block text-gray-700 hover:text-indigo-600">
            Invoices
          </Link>
          <Link to="/user-registry" className="block text-gray-700 hover:text-indigo-600">
            User-Registry
          </Link>
        </nav>
      </div>

      {/* Auth Buttons at Bottom */}
      <div className="mt-auto p-4 border-t">
        {isLoggedIn ? (
          <button
            onClick={handleLogout} // ✅ FIXED: No more page reload
            className="flex items-center w-full p-3 text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </button>
        ) : (
          <button
            onClick={login}
            disabled={isConnecting}
            className="flex items-center w-full p-3 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4 mr-3" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </div>
  );
}
