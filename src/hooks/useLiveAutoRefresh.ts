import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function notifyDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-data-updated'));
    window.dispatchEvent(new CustomEvent('app:data-updated'));
  }
}

interface UseLiveAutoRefreshOptions {
  intervalMs?: number; // default 8000ms (8 seconds)
  tables?: string[];   // specific Supabase tables to listen for, or empty for all
  enabled?: boolean;   // conditionally enable/disable
}

export function useLiveAutoRefresh(
  refreshCallback: () => void | Promise<void>,
  deps: any[] = [],
  options: UseLiveAutoRefreshOptions = {}
) {
  const { intervalMs = 8000, tables, enabled = true } = options;
  const callbackRef = useRef(refreshCallback);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) return;

    let isSubscribed = true;

    const safeExecute = async () => {
      if (!isSubscribed) return;
      try {
        await callbackRef.current();
      } catch (e) {
        console.warn('Auto refresh error:', e);
      }
    };

    // 1. Initial execution
    safeExecute();

    // 2. Background polling interval
    const timer = setInterval(() => {
      safeExecute();
    }, intervalMs);

    // 3. Event Listeners for window focus, visibility, and custom events
    const handleTrigger = () => {
      safeExecute();
    };

    window.addEventListener('focus', handleTrigger);
    window.addEventListener('app-data-updated', handleTrigger);
    window.addEventListener('app:data-updated', handleTrigger);
    window.addEventListener('mismatch_resolved', handleTrigger);
    window.addEventListener('storage', handleTrigger);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        safeExecute();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 4. Supabase Realtime Postgres Changes Listener
    let channel: any = null;
    if (supabase) {
      try {
        const channelName = `realtime-auto-sync-${Math.random().toString(36).substring(2, 8)}`;
        channel = supabase.channel(channelName);

        if (tables && tables.length > 0) {
          tables.forEach((t) => {
            channel = channel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table: t },
              handleTrigger
            );
          });
        } else {
          channel = channel.on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            handleTrigger
          );
        }

        channel.subscribe();
      } catch (err) {
        // Fall back to timer + event triggers
      }
    }

    return () => {
      isSubscribed = false;
      clearInterval(timer);
      window.removeEventListener('focus', handleTrigger);
      window.removeEventListener('app-data-updated', handleTrigger);
      window.removeEventListener('app:data-updated', handleTrigger);
      window.removeEventListener('mismatch_resolved', handleTrigger);
      window.removeEventListener('storage', handleTrigger);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [enabled, intervalMs, JSON.stringify(tables), ...deps]);
}
