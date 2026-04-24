import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { WalletState } from '../types';

// Safely access the freighter API injected by the extension into window
function getFreighter(): Record<string, (...args: unknown[]) => Promise<unknown>> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.freighter ?? w.freighterApi ?? null;
}

async function freighterRequest<T>(method: string, ...args: unknown[]): Promise<T> {
  // Try the npm package first
  try {
    const api = await import('@stellar/freighter-api');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (api as any)[method];
    if (typeof fn === 'function') {
      const res = await fn(...args);
      return res as T;
    }
  } catch {
    // fall through to window injection
  }
  // Fallback: window.freighter direct injection
  const f = getFreighter();
  if (!f || typeof f[method] !== 'function') {
    throw new Error('Freighter not found');
  }
  return f[method](...args) as Promise<T>;
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
        const allowed = await freighterRequest<{ isAllowed: boolean }>('isAllowed');
        if (allowed?.isAllowed) {
          const addr = await freighterRequest<{ address: string }>('getAddress');
          if (addr?.address) {
            setWallet({ address: addr.address, isConnected: true, isConnecting: false, network: 'testnet' });
          }
        }
      } catch {
        // not installed or not ready
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true }));
    try {
      const res = await freighterRequest<{ address?: string; error?: string }>('requestAccess');
      if (res?.error) throw new Error(res.error);
      if (!res?.address) throw new Error('No address returned from Freighter');
      setWallet({ address: res.address, isConnected: true, isConnecting: false, network: 'testnet' });
      toast.success('Wallet connected!');
    } catch (err: unknown) {
      setWallet((w) => ({ ...w, isConnecting: false }));
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('undefined')) {
        toast.error('Freighter not detected. Please install it from freighter.app', { duration: 6000 });
      } else {
        toast.error(`Connection failed: ${msg}`);
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: null, isConnected: false, isConnecting: false, network: null });
    toast.success('Wallet disconnected');
  }, []);

  return { wallet, connect, disconnect };
}
