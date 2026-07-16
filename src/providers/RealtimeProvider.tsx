import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const reconnectAttempts = useRef(0);
  const maxDelay = 16000;

  useEffect(() => {
    if (!user?.restaurant_id) return;
    
    let isSubscribed = true;
    let timeoutId: any;

    const channel = supabase.channel(`restaurant_${user.restaurant_id}`);

    const connect = () => {
      if (!isSubscribed) return;
      
      channel
        .on('postgres_changes', { event: '*', schema: 'public', filter: `restaurant_id=eq.${user.restaurant_id}` }, (payload) => {
          // Centralized handling could be done here or components subscribe to specific tables
          // For now, we dispatch a custom event that stores can listen to
          window.dispatchEvent(new CustomEvent('supabase_realtime_update', { detail: payload }));
        })
        .subscribe((subStatus, _err) => {
          if (!isSubscribed) return;
          
          if (subStatus === 'SUBSCRIBED') {
            reconnectAttempts.current = 0;
          } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') {
            // Exponential backoff reconnect
            if (reconnectAttempts.current < 5) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxDelay);
              reconnectAttempts.current++;
              timeoutId = setTimeout(connect, delay);
            }
          }
        });
    };

    connect();

    return () => {
      isSubscribed = false;
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [user?.restaurant_id]);

  // Status is available but we are not rendering it. 
  // It could be put into a store and consumed by ConnectionStatus component.

  return <>{children}</>;
}
