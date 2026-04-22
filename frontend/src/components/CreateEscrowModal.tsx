import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createEscrow } from '../lib/stellar';

interface CreateEscrowModalProps {
  walletAddress: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateEscrowModal({ walletAddress, onClose, onCreated }: CreateEscrowModalProps) {
  const [freelancer, setFreelancer] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!freelancer.trim() || !amount) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const contractId = await createEscrow(walletAddress, freelancer.trim(), amountNum);
      toast.success(`Escrow created: ${contractId.slice(0, 10)}...`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create escrow');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Create New Escrow</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your Address (Client)
            </label>
            <input
              type="text"
              value={walletAddress}
              readOnly
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Freelancer Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="G..."
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stellar-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount (XLM) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="100"
                min="0.0000001"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 pr-14 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stellar-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                XLM
              </span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">How it works:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Create escrow → deposit funds</li>
              <li>Freelancer submits work with proof</li>
              <li>You approve → funds released automatically</li>
              <li>Dispute? Admin resolves fairly</li>
            </ol>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !freelancer.trim() || !amount}
              className="flex-1 py-2.5 px-4 bg-stellar-600 hover:bg-stellar-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Escrow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
