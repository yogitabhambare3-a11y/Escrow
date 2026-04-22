import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { StateBadge } from './StateBadge';
import {
  deposit,
  submitWork,
  approveWork,
  raiseDispute,
  resolveDispute,
  formatXlm,
  truncateAddress,
} from '../lib/stellar';
import type { EscrowDetails } from '../types';

interface EscrowCardProps {
  escrow: EscrowDetails;
  walletAddress: string;
  onRefresh: () => void;
}

export function EscrowCard({ escrow, walletAddress, onRefresh }: EscrowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proofInput, setProofInput] = useState('');

  const isClient = walletAddress === escrow.client;
  const isFreelancer = walletAddress === escrow.freelancer;

  async function handle(action: () => Promise<void>, successMsg: string) {
    setLoading(true);
    try {
      await action();
      toast.success(successMsg);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StateBadge state={escrow.state} />
              {isClient && (
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                  You're Client
                </span>
              )}
              {isFreelancer && (
                <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">
                  You're Freelancer
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-mono text-gray-500 truncate">
              {truncateAddress(escrow.contractId)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-gray-900">
              {formatXlm(escrow.amount)} XLM
            </p>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500 mb-0.5">Client</p>
            <p className="font-mono text-gray-700 truncate">{truncateAddress(escrow.client)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500 mb-0.5">Freelancer</p>
            <p className="font-mono text-gray-700 truncate">{truncateAddress(escrow.freelancer)}</p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Hide actions</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Show actions</>
          )}
        </button>
      </div>

      {/* Actions */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 sm:p-5 space-y-3">
          {/* Proof URI display */}
          {escrow.proofUri && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg text-xs">
              <ExternalLink className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <a
                href={escrow.proofUri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${escrow.proofUri.slice(7)}` : escrow.proofUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 truncate hover:underline"
              >
                {escrow.proofUri}
              </a>
            </div>
          )}

          {/* Client: Deposit */}
          {isClient && escrow.state === 'Created' && (
            <button
              onClick={() => handle(() => deposit(escrow.contractId, walletAddress), 'Funds deposited!')}
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Processing...' : '💰 Deposit Funds'}
            </button>
          )}

          {/* Freelancer: Submit Work */}
          {isFreelancer && escrow.state === 'Funded' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="IPFS hash or proof URL..."
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stellar-500"
              />
              <button
                onClick={() => handle(() => submitWork(escrow.contractId, proofInput, walletAddress), 'Work submitted!')}
                disabled={loading || !proofInput.trim()}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Processing...' : '📤 Submit Work'}
              </button>
            </div>
          )}

          {/* Client: Approve or Dispute */}
          {isClient && escrow.state === 'Submitted' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handle(() => approveWork(escrow.contractId, walletAddress), 'Work approved! Funds released.')}
                disabled={loading}
                className="py-2 px-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? '...' : '✅ Approve'}
              </button>
              <button
                onClick={() => handle(() => raiseDispute(escrow.contractId, walletAddress), 'Dispute raised!')}
                disabled={loading}
                className="py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? '...' : '⚠️ Dispute'}
              </button>
            </div>
          )}

          {/* Freelancer: Raise dispute on funded */}
          {isFreelancer && escrow.state === 'Funded' && (
            <button
              onClick={() => handle(() => raiseDispute(escrow.contractId, walletAddress), 'Dispute raised!')}
              disabled={loading}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Processing...' : '⚠️ Raise Dispute'}
            </button>
          )}

          {/* Admin: Resolve dispute */}
          {escrow.state === 'Disputed' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">Admin: Resolve Dispute</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handle(() => resolveDispute(escrow.contractId, true, walletAddress), 'Freelancer wins!')}
                  disabled={loading}
                  className="py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Freelancer Wins
                </button>
                <button
                  onClick={() => handle(() => resolveDispute(escrow.contractId, false, walletAddress), 'Client refunded!')}
                  disabled={loading}
                  className="py-2 px-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Client Wins
                </button>
              </div>
            </div>
          )}

          {/* Released state */}
          {escrow.state === 'Released' && (
            <p className="text-center text-sm text-emerald-600 font-medium py-2">
              🎉 Escrow completed successfully
            </p>
          )}
        </div>
      )}
    </div>
  );
}
