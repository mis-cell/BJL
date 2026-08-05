import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useHeartbeat(pingIntervalMs = 15000) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    // Initial check
    let isMounted = true;
    
    const checkConnection = async () => {
      if (!navigator.onLine) {
        if (isMounted) setIsOnline(false);
        return;
      }
      
      try {
        // Fast, lightweight query just to verify connection
        const { error } = await supabase.from('user_master').select('user_id').limit(1).abortSignal(AbortSignal.timeout(5000));
        
        if (isMounted) {
          // If we hit an auth error or other expected DB error, we are still technically online to the server
          // If we hit a fetch error or timeout, we are offline
          if (error && (error.code === 'FetchError' || error.message?.includes('timeout'))) {
            setIsOnline(false);
          } else {
            setIsOnline(true);
          }
        }
      } catch (e) {
        if (isMounted) setIsOnline(false);
      }
    };

    // Check immediately on mount
    checkConnection();

    // Set up periodic heartbeat
    const intervalId = setInterval(checkConnection, pingIntervalMs);

    // Listen to standard browser events as fallbacks/triggers
    const handleOnline = () => {
      checkConnection(); // Immediately verify with DB when browser says online
    };
    
    const handleOffline = () => {
      if (isMounted) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pingIntervalMs]);

  return isOnline;
}
