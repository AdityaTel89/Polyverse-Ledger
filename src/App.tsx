import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Blockchains from './pages/Blockchains';
import Users from './pages/Users';
import Invoices from './pages/Invoices';
import UserRegistryPage from './pages/UserRegistryPage'; // ✅ Add this import

function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/blockchains" element={<Blockchains />} />
          <Route path="/users" element={<Users />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/user-registry" element={<UserRegistryPage />} /> {/* ✅ New route */}
        </Routes>
      </div>
    </div>
  );
}

export default App;
