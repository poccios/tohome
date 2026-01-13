/**
 * Hook for managing admin key in sessionStorage
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tohome_admin_key';

export function useAdminKey() {
  const [adminKey, setAdminKeyState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load admin key from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setAdminKeyState(stored);
    setIsLoaded(true);
  }, []);

  // Save admin key to sessionStorage
  const setAdminKey = (key: string | null) => {
    if (key) {
      sessionStorage.setItem(STORAGE_KEY, key);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    setAdminKeyState(key);
  };

  // Clear admin key
  const clearAdminKey = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminKeyState(null);
  };

  return {
    adminKey,
    isLoaded,
    setAdminKey,
    clearAdminKey,
    hasAdminKey: !!adminKey,
  };
}
