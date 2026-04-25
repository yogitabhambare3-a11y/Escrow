import { useState, useCallback } from 'react';
import { getEscrows, getEscrowDetails } from '../lib/stellar';
import type { EscrowDetails } from '../types';

export function useEscrows(signerAddress: string | null) {
  const [escrows, setEscrows] = useState<EscrowDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!signerAddress) return;
    setLoading(true);
    setError(null);
    try {
      const ids = await getEscrows(signerAddress);
      const details = await Promise.all(
        ids.map((id) => getEscrowDetails(id, signerAddress).catch((e) => {
          console.error('getEscrowDetails error for', id, e);
          return null;
        }))
      );
      setEscrows(details.filter(Boolean) as EscrowDetails[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load escrows');
    } finally {
      setLoading(false);
    }
  }, [signerAddress]);

  return { escrows, loading, error, refresh };
}
