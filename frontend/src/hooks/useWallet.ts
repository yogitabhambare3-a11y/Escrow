import { useState, useCallback, useEffect } from 'react';
import { requestAccess, getAddress, isAllowed } from '@stellar/freighter-api';
import toast from 'react-hot-toast';
import type { WalletState } from '../types';

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    network: null,
  });

  // Auto-reconnect if already allowed
  useEffect(() => {
    (async () => {
      try {
        const allowedRes = await isAllowed();
        if (allowedRes.isAllowed) {
          const addressRes = await getAddress();
          if (addressRes.address && !addressRes.error) {
            setWallet({
              address: addressRes.address,
              isConnected: true,
              isConnecting: false,
              network: 'testnet',
            });
          }
        }
      } catch {
        // Freighter not ready yet
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
      // requestAccess() handles everything — prompts if not allowed, returns address if already allowed
      const accessRes = await requestAccess();
      if (accessRes.error) {
        toast.error(`Connection failed: ${accessRes.error}`);
        setWallet((w) => ({ ...w, isConnecting: false }));
        return;
      }
      setWallet({
        address: accessRes.address,
        isConnected: true,
        isConnecting: false,
        network: 'testnet',
      });
      toast.success('Wallet connected!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Connection error: ${msg}`);
      setWallet((w) => ({ ...w, isConnecting: false }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, isConnected: false, isConnecting: false, network: null });
    toast.success('Wallet disconnected');
  }, []);

  return { wallet, connect, disconnect };
}
