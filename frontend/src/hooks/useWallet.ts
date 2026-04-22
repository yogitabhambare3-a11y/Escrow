import { useState, useCallback, useEffect } from 'react';
import { isConnected, getPublicKey, isAllowed } from '@stellar/freighter-api';
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
        const connected = await isConnected();
        const allowed = await isAllowed();
        // Handle both boolean and object return types across SDK versions
        const isConn = typeof connected === 'boolean' ? connected : (connected as { isConnected: boolean }).isConnected;
        const isAllow = typeof allowed === 'boolean' ? allowed : (allowed as { isAllowed: boolean }).isAllowed;
        if (isConn && isAllow) {
          const pubKey = await getPublicKey();
          const address = typeof pubKey === 'string' ? pubKey : (pubKey as { address: string }).address;
          setWallet({
            address,
            isConnected: true,
            isConnecting: false,
            network: 'testnet',
          });
        }
      } catch {
        // Freighter not installed or not connected
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
      const pubKey = await getPublicKey();
      const address = typeof pubKey === 'string' ? pubKey : (pubKey as { address: string }).address;
      setWallet({
        address,
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
