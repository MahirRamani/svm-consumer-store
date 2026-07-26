// app/admin/dashboard/layout.tsx
'use client';

import { Store, Bell, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { getAccessibleTabs, hasTabAccess } from '@/lib/config/tabs-registry';
import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { allowedTabs, loading, error } = useUserPermissions();
  const pathname = usePathname();
  const router = useRouter();
  const accessibleTabs = getAccessibleTabs(allowedTabs);

  const handleLogout = async () => {
    await signOut({
      callbackUrl: '/login',
      redirect: true
    });
  };

  const handleTabChange = (tabId: string) => {
    if (hasTabAccess(tabId as any, allowedTabs)) {
      router.push(`/admin/dashboard/${tabId}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4" size="default">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  // No access
  if (accessibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Access</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to access any tabs. Contact your administrator.
          </AlertDescription>
          <Button onClick={handleLogout} className="mt-4" size="sm">
            Logout
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - persists across tab changes */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-500 text-white w-10 h-10 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Consumer Store Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm">
              <Bell className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Notifications</span>
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation - persists across tab changes */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 flex space-x-8 overflow-x-auto">
          {accessibleTabs.map((tab) => {
            const isActive = pathname === `/admin/dashboard/${tab.id}`;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2.5 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-blue-600'
                  }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab Content - this changes */}
      <main className="p-2.5 px-3">{children}</main>
    </div>
  );
}