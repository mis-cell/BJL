import { useState, useEffect } from 'react';

export function useIdleTimer(timeoutMs = 15 * 60 * 1000, onIdle: () => void) {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    let timeoutId: number;

    const handleActivity = () => {
      if (isIdle) {
        setIsIdle(false);
      }
      clearTimeout(timeoutId);
      // @ts-ignore
      timeoutId = setTimeout(() => {
        setIsIdle(true);
        onIdle();
      }, timeoutMs);
    };

    // Initial setup
    handleActivity();

    // Event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [timeoutMs, isIdle, onIdle]);

  return isIdle;
}
