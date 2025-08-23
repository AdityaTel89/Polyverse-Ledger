// src/pages/blockchain.tsx
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Network, Plus, Wallet, RefreshCw } from 'lucide-react';
import { BASE_API_URL } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';

// Match the actual backend response structure
type Blockchain = {
  id: string;
  name: string;
  ubid: string;
  bnsName?: string | null;
  networkType: string;
  chainProtocol: string;
  createdAt: string;
  updatedAt: string;
  registeredAt?: string;
  isPrimary?: boolean;
  crossChainWalletAddress?: string;
};

const BlockchainsPage = () => {
  const { isLoggedIn, walletAddress, blockchainId, login } = useAuth();
  
  const [blockchains, setBlockchains] = useState<Blockchain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [blockchainName, setBlockchainName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch user-specific blockchains
  const fetchBlockchains = async () => {
    if (!isLoggedIn || !walletAddress || !blockchainId) {
      setBlockchains([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${BASE_API_URL}/blockchain/user-registered`);
      url.searchParams.append('walletAddress', walletAddress);
      url.searchParams.append('blockchainId', blockchainId);


      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch blockchains: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setBlockchains(data.data);
        if (data.data.length === 0 && data.message) {
          setError(data.message);
        } else {
          setError(null);
        }
      } else {
        setBlockchains([]);
        setError(data.message || 'No blockchain data found');
      }
      
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to fetch blockchains');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when authentication state changes
  useEffect(() => {
    fetchBlockchains();
  }, [isLoggedIn, walletAddress, blockchainId]);

  // Register new blockchain
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!blockchainName.trim()) {
      alert('Please enter a blockchain name');
      return;
    }

    if (!walletAddress || !blockchainId) {
      alert('Please connect your wallet first');
      return;
    }

    setSubmitting(true);

    try {
      
      const response = await fetch(`${BASE_API_URL}/blockchain/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: blockchainName.trim(),
          walletAddress,
          blockchainId
        }),
      });

  
      
      if (response.ok) {
        const result = await response.json();
  

        setShowModal(false);
        setBlockchainName('');
        await fetchBlockchains(); // Refresh the list
        alert('Blockchain registered successfully!');
      } else {
        const errorData = await response.json();
        console.error('Registration error:', errorData);
        alert(errorData.error || 'Failed to register blockchain');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register blockchain. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show login prompt if not authenticated
  if (!isLoggedIn) {
    return (
      <Layout>
        <div className="p-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
              <Wallet className="w-16 h-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
              <p className="text-gray-600 mb-6">
                Please connect your MetaMask wallet to view and manage your blockchain registrations.
              </p>
              <button
                onClick={login}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Connect MetaMask Wallet
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Registered Blockchains</h1>
            <p className="text-gray-500">
              Wallet: <span className="font-mono text-sm">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={fetchBlockchains}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Register New
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading your blockchain networks...</p>
          </div>
        )}
        
        {/* Error state */}
        {error && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-yellow-800">{error}</p>
              <button
                onClick={fetchBlockchains}
                className="text-yellow-600 hover:text-yellow-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && blockchains.length === 0 && (
          <div className="text-center py-12">
            <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No blockchain networks registered yet for this wallet</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Register your first blockchain
            </button>
          </div>
        )}

        {/* Blockchain cards */}
        {blockchains.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blockchains.map((chain) => (
              <div key={chain.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <Network className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{chain.name}</h3>
                      {chain.isPrimary && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {chain.networkType} • {chain.chainProtocol}
                    </p>
                    {chain.crossChainWalletAddress && (
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        {chain.crossChainWalletAddress.slice(0, 6)}...{chain.crossChainWalletAddress.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-xs text-gray-600 mb-1">
                    <span className="font-medium">UBID:</span>
                  </div>
                  <div className="text-xs font-mono bg-gray-50 p-2 rounded break-all">
                    {chain.ubid}
                  </div>
                  {chain.bnsName && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-600">BNS:</span>
                      <span className="text-xs text-gray-500 ml-1">{chain.bnsName}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Status</span>
                    <span className="text-green-600 font-medium">Active</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Registered On</span>
                    <span className="font-medium">
                      {chain.registeredAt ? 
                        new Date(chain.registeredAt).toLocaleDateString() : 
                        (chain.createdAt ? new Date(chain.createdAt).toLocaleDateString() : 'N/A')
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Registration modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4">Register New Blockchain</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blockchain Name
                  </label>
                  <input
                    type="text"
                    value={blockchainName}
                    onChange={(e) => setBlockchainName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Ethereum, Polygon, BSC"
                    required
                    maxLength={100}
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be registered to wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                  </p>
                </div>
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setBlockchainName('');
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={submitting}
                  >
                    {submitting ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BlockchainsPage;
