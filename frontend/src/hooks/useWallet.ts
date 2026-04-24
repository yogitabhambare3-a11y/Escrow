import { useState, useCallback, useEffect } from 'react';
import { isConnected, isAllowed, requestAccess, getAddress } from '@stellar/freighter-api';
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
        const connectedRes = await isConnected();
        const allowedRes = await isAllowed();
        if (connectedRes.isConnected && allowedRes.isAllowed) {
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
        // Freighter not installed
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    // Check if Freighter is installed
    const connectedRes = await isConnected();
    if (!connectedRes.isConnected) {
      toast.error('Freighter wallet not found. Please install it from freighter.app', {
        duration: 6000,
      });
      window.open('https://www.freighter.app', '_blank');
      return;
    }

    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
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
