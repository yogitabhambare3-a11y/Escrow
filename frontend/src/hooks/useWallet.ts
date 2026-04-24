import { useState, useCallback, useEffect } from 'react';
import { isConnected, isAllowed, requestAccess, getAddress } from '@stellar/freighter-api';
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
        // Freighter not installed or not connected
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
      const accessRes = await requestAccess();
      if (accessRes.error) {
        throw new Error(accessRes.error);
      }
      setWallet({
        address: accessRes.address,
        isConnected: true,
        isConnecting: false,
        network: 'testnet',
      });
    } catch (err) {
      setWallet((w) => ({ ...w, isConnecting: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, isConnected: false, isConnecting: false, network: null });
  }, []);

  return { wallet, connect, disconnect };
}
