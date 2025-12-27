// hooks/use-user-permissions.ts
import { useState, useEffect } from 'react';
import type { TabId } from '@/lib/config/tabs-registry';

interface UserPermissionsResponse {
  allowedTabs: TabId[];
  userRole: 'ADMIN' | 'SELLER' | string;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and manage user permissions
 * Fetches user info from /api/users/me endpoint
 */
export function useUserPermissions(): UserPermissionsResponse {
  const [allowedTabs, setAllowedTabs] = useState<TabId[]>([]);
  // const [userRole, setUserRole] = useState<'ADMIN' | 'SELLER' | string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setLoading(true);
        
        // Call the correct endpoint
        const response = await fetch('/api/users/me');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch user permissions');
        }

        const result = await response.json();
        
        // Handle your API response structure
        // Based on your successResponse format: { success: true, data: {...} }
        const userData = result.data || result;
        
        // Extract role and allowed tabs
        const role = userData.role || '';
        const tabs = userData.allowedTabs || [];

        setUserRole(role);
        setAllowedTabs(tabs);
      } catch (err) {
        console.error('Error fetching user permissions:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  return {
    allowedTabs,
    userRole,
    loading,
    error,
  };
}

// Alternative version if you're using a different auth pattern:
// export function useUserPermissions() {
//   const { data: session, status } = useSession(); // if using NextAuth
//
//   return {
//     allowedTabs: session?.user?.allowedTabs || [],
//     userRole: session?.user?.role || '',
//     loading: status === 'loading',
//     error: null,
//   };
// }




// // hooks/use-user-permissions.ts
// import { useState, useEffect } from 'react';
// import type { TabId } from '@/lib/config/tabs-registry';

// interface UseUserPermissionsResult {
//   allowedTabs: TabId[];
//   loading: boolean;
//   error: Error | null;
// }

// export function useUserPermissions(): UseUserPermissionsResult {
//   const [allowedTabs, setAllowedTabs] = useState<TabId[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<Error | null>(null);

//   useEffect(() => {
//     async function fetchPermissions() {
//       try {
//         const response = await fetch('/api/users/me/tabs');
        
//         if (!response.ok) {
//           throw new Error('Failed to fetch permissions');
//         }

//         const data = await response.json();
//         setAllowedTabs(data.data?.allowedTabs || ['overview']); // Fallback to overview
//       } catch (err) {
//         setError(err instanceof Error ? err : new Error('Unknown error'));
//         setAllowedTabs(['overview']); // Fallback
//       } finally {
//         setLoading(false);
//       }
//     }

//     fetchPermissions();
//   }, []);

//   return { allowedTabs, loading, error };
// }