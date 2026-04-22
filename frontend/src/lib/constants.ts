export const NETWORK = import.meta.env.VITE_NETWORK || 'testnet';
export const RPC_URL =
  import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org';
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ||
  'Test SDF Network ; September 2015';
export const FACTORY_CONTRACT_ID =
  import.meta.env.VITE_FACTORY_CONTRACT_ID || '';
export const DISPUTE_CONTRACT_ID =
  import.meta.env.VITE_DISPUTE_CONTRACT_ID || '';
export const TOKEN_ADDRESS =
  import.meta.env.VITE_TOKEN_ADDRESS ||
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const STROOPS_PER_XLM = 10_000_000n;

export const STATE_COLORS: Record<string, string> = {
  Created: 'bg-gray-100 text-gray-700',
  Funded: 'bg-blue-100 text-blue-700',
  Submitted: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Released: 'bg-emerald-100 text-emerald-700',
  Disputed: 'bg-red-100 text-red-700',
};

export const STATE_LABELS: Record<string, string> = {
  Created: '🆕 Created',
  Funded: '💰 Funded',
  Submitted: '📤 Submitted',
  Approved: '✅ Approved',
  Released: '🎉 Released',
  Disputed: '⚠️ Disputed',
};
