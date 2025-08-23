import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Blockchains from './pages/Blockchains';
import Users from './pages/Users';
import Invoices from './pages/Invoices';
import UserRegistryPage from './pages/UserRegistryPage';
import Welcome from './pages/Welcome';

function App() {
  return (
    <AuthProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/blockchains" element={<Blockchains />} />
            <Route path="/users" element={<Users />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/user-registry" element={<UserRegistryPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}

export default App;
