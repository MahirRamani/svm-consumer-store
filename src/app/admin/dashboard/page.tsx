// app/admin/dashboard/page.tsx
// This handles redirect from /admin/dashboard to /admin/dashboard/{first-tab}
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { getAccessibleTabs } from '@/lib/config/tabs-registry';

export default function DashboardRedirect() {
  const router = useRouter();
  const { allowedTabs, loading } = useUserPermissions();
  const accessibleTabs = getAccessibleTabs(allowedTabs);

  useEffect(() => {
    if (!loading && accessibleTabs.length > 0) {
      router.replace(`/admin/dashboard/${accessibleTabs[0].id}`);
    }
  }, [loading, accessibleTabs, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
