import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { WalletState } from '../types';

async function getFreighterAddress(): Promise<string> {
  const api = await import('@stellar/freighter-api');

  // Try requestAccess first (prompts user if needed)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await (api as any).requestAccess();
    if (res?.address) return res.address;
  } catch { /* try next */ }

  // Try getAddress (silent, works if already allowed)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await (api as any).getAddress();
    if (res?.address) return res.address;
  } catch { /* try next */ }

  // Try legacy getPublicKey
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await (api as any).getPublicKey?.();
    if (typeof res === 'string' && res.length > 0) return res;
    if (res?.address) return res.address;
  } catch { /* try next */ }

  // Try window.freighter direct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const freighter = w.freighter ?? w.freighterApi;
  if (freighter) {
    try {
      const res = await freighter.getPublicKey?.();
      if (typeof res === 'string' && res.length > 0) return res;
    } catch { /* fail */ }
    try {
      const res = await freighter.requestAccess?.();
      if (res?.address) return res.address;
    } catch { /* fail */ }
  }

  throw new Error('Could not get address from Freighter. Make sure your wallet is unlocked and has an account.');
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    network: null,
  });

  // Auto-reconnect on mount
  useEffect(() => {
    (async () => {
      try {
        const api = await import('@stellar/freighter-api');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allowed: any = await (api as any).isAllowed();
        if (allowed?.isAllowed) {
          const address = await getFreighterAddress();
          if (address) {
            setWallet({ address, isConnected: true, isConnecting: false, network: 'testnet' });
          }
        }
      } catch { /* not installed or locked */ }
    })();
  }, []);

  const connect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
      const address = await getFreighterAddress();
      setWallet({ address, isConnected: true, isConnecting: false, network: 'testnet' });
      toast.success('Wallet connected!');
    } catch (err: unknown) {
      setWallet((w) => ({ ...w, isConnecting: false }));
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, { duration: 7000 });
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, isConnected: false, isConnecting: false, network: null });
    toast.success('Wallet disconnected');
  }, []);

  return { wallet, connect, disconnect };
}
