import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Wallet } from 'lucide-react';
import { EscrowCard } from '../components/EscrowCard';
import { CreateEscrowModal } from '../components/CreateEscrowModal';
import { StatsBar } from '../components/StatsBar';
import { useEscrows } from '../hooks/useEscrows';

interface DashboardProps {
  walletAddress: string | null;
  onConnect: () => void;
}

export function Dashboard({ walletAddress, onConnect }: DashboardProps) {
  const { escrows, loading, error, refresh } = useEscrows(walletAddress);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    if (walletAddress) refresh();
  }, [walletAddress, refresh]);

  const filters = ['All', 'Created', 'Funded', 'Submitted', 'Disputed', 'Released'];
  const filtered =
    filter === 'All' ? escrows : escrows.filter((e) => e.state === filter);

  if (!walletAddress) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 bg-stellar-100 rounded-2xl flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-stellar-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Connect your Freighter wallet to create and manage decentralized escrow contracts on Stellar.
        </p>
        <button
          onClick={onConnect}
          className="px-6 py-3 bg-stellar-600 hover:bg-stellar-700 text-white font-medium rounded-xl transition-colors"
        >
          Connect Freighter
        </button>
        <p className="mt-4 text-xs text-gray-400">
          Don't have Freighter?{' '}
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stellar-600 hover:underline"
          >
            Install it here
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your escrow contracts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stellar-600 hover:bg-stellar-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Escrow</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar escrows={escrows} />

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-stellar-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Escrow grid */}
      {loading && escrows.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">
            {filter === 'All'
              ? 'No escrows yet. Create your first one!'
              : `No ${filter} escrows found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((escrow) => (
            <EscrowCard
              key={escrow.contractId}
              escrow={escrow}
              walletAddress={walletAddress}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateEscrowModal
          walletAddress={walletAddress}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
