import { Wallet, LogOut, Zap } from 'lucide-react';
import { truncateAddress } from '../lib/stellar';

interface NavbarProps {
  address: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Navbar({ address, isConnecting, onConnect, onDisconnect }: NavbarProps) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stellar-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:block">
              FreelanceEscrow
            </span>
            <span className="font-bold text-gray-900 text-lg sm:hidden">FE</span>
          </div>

          {/* Network badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-yellow-700">Testnet</span>
          </div>

          {/* Wallet */}
          {address ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stellar-50 border border-stellar-200 rounded-lg">
                <Wallet className="w-4 h-4 text-stellar-600" />
                <span className="text-sm font-mono text-stellar-700">
                  {truncateAddress(address)}
                </span>
              </div>
              <button
                onClick={onDisconnect}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Disconnect"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 bg-stellar-600 hover:bg-stellar-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : 'Connect Freighter'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
