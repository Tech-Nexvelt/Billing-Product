import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

type Status = 'connected' | 'reconnecting' | 'disconnected';

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('connected');

  useEffect(() => {
    const channel = supabase.channel('connection-check');

    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') setStatus('connected');
      else if (state === 'CHANNEL_ERROR' || state === 'CLOSED') setStatus('disconnected');
      else setStatus('reconnecting');
    });

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (status === 'connected') return null;

  return (
    <div className={cn(
      'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-all duration-300',
      status === 'reconnecting'
        ? 'bg-yellow-500 text-white'
        : 'bg-destructive text-destructive-foreground'
    )}>
      {status === 'reconnecting' ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Reconnecting...
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          No connection
        </>
      )}
    </div>
  );
}
