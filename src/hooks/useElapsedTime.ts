import { useState, useEffect, useCallback } from 'react';
import { getElapsedSeconds, formatElapsedTime } from '@/utils/elapsed-time';

/**
 * Hook that returns a live-updating elapsed time string computed from a timestamp.
 * NEVER stored in the database — always computed from orders.created_at.
 * Updates every 60 seconds (no need for per-second updates in production).
 */
export function useElapsedTime(createdAt: string | null | undefined): string {
  const compute = useCallback(() => {
    if (!createdAt) return '';
    return formatElapsedTime(getElapsedSeconds(createdAt));
  }, [createdAt]);

  const [elapsed, setElapsed] = useState<string>(compute);

  useEffect(() => {
    if (!createdAt) return;
    setElapsed(compute());
    const interval = setInterval(() => setElapsed(compute()), 60_000);
    return () => clearInterval(interval);
  }, [createdAt, compute]);

  return elapsed;
}
