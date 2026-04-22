export type EscrowState =
  | 'Created'
  | 'Funded'
  | 'Submitted'
  | 'Approved'
  | 'Released'
  | 'Disputed';

export interface EscrowDetails {
  contractId: string;
  client: string;
  freelancer: string;
  amount: bigint;
  state: EscrowState;
  proofUri?: string;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: string | null;
}
