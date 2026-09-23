// app/admin/dashboard/[tab]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { getAccessibleTabs, hasTabAccess, type TabId } from '@/lib/config/tabs-registry';
import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function TabPage() {
  const params = useParams();
  const router = useRouter();
  const { userAllowedTabs, loading } = useUserPermissions();
  const accessibleTabs = getAccessibleTabs(userAllowedTabs);

  const tabId = params.tab as TabId;

  // Redirect if user doesn't have access to this tab
  useEffect(() => {
    if (!loading && !hasTabAccess(tabId, userAllowedTabs)) {
      // Redirect to first accessible tab
      if (accessibleTabs.length > 0) {
        router.replace(`/admin/dashboard/${accessibleTabs[0].id}`);
      }
    }
  }, [loading, tabId, userAllowedTabs, accessibleTabs, router]);

  // Loading while checking permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const tab = accessibleTabs.find((t) => t.id === tabId);

  if (!tab) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Tab Not Found</AlertTitle>
        <AlertDescription>
          You don&apos;t have access to this tab or it doesn&apos;t exist.
        </AlertDescription>
        <Button
          onClick={() => router.push(`/admin/dashboard/${accessibleTabs[0]?.id}`)}
          className="mt-4"
          size="sm"
        >
          Go to Dashboard
        </Button>
      </Alert>
    );
  }

  const Component = tab.component;
  return (
    <div className="p-0">
      <Component />
    </div>
  );
}