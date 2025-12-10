// hooks/use-user-permissions.ts
import { useState, useEffect } from 'react';
import type { TabId } from '@/lib/config/tabs-registry';

interface UseUserPermissionsResult {
  allowedTabs: TabId[];
  loading: boolean;
  error: Error | null;
}

export function useUserPermissions(): UseUserPermissionsResult {
  const [allowedTabs, setAllowedTabs] = useState<TabId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        const response = await fetch('/api/users/me/tabs');
        
        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json();
        setAllowedTabs(data.data?.allowedTabs || ['overview']); // Fallback to overview
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setAllowedTabs(['overview']); // Fallback
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, []);

  return { allowedTabs, loading, error };
}