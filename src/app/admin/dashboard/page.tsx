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

// // app/admin/dashboard/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { Store, Bell, LogOut, AlertCircle } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { useUserPermissions } from '@/hooks/use-user-permissions';
// import { getAccessibleTabs, hasTabAccess, type TabId } from '@/lib/config/tabs-registry';
// import { signOut } from 'next-auth/react';

// export default function Dashboard() {
//   const { allowedTabs, loading, error } = useUserPermissions();
//   const [activeTab, setActiveTab] = useState<TabId | null>(null); 
//   const router = useRouter();

//   // Get tabs user can access
//   const accessibleTabs = getAccessibleTabs(allowedTabs);

//   // Set first accessible tab as active
//   useEffect(() => {
//     if (!loading && accessibleTabs.length > 0 && !activeTab) {
//       setActiveTab(accessibleTabs[0].id);
//     }
//   }, [loading, accessibleTabs, activeTab]);

//   // Handle logout
//   const handleLogout = async () => {
//     // This properly handles CSRF tokens
//     await signOut({ 
//       callbackUrl: '/login',
//       redirect: true 
//     });
//   };

//   // Handle tab change
//   const handleTabChange = (tabId: TabId) => {
//     if (hasTabAccess(tabId, allowedTabs)) {
//       setActiveTab(tabId);
//     }
//   };

//   // Loading state
//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
//           <p className="mt-4 text-gray-600">Loading dashboard...</p>
//         </div>
//       </div>
//     );
//   }

//   // Error state
//   if (error) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
//         <Alert variant="destructive" className="max-w-md">
//           <AlertCircle className="h-4 w-4" />
//           <AlertTitle>Error</AlertTitle>
//           <AlertDescription>{error.message}</AlertDescription>
//           <Button onClick={() => window.location.reload()} className="mt-4" size="default">
//             Retry
//           </Button>
//         </Alert>
//       </div>
//     );
//   }

//   // No access
//   if (accessibleTabs.length === 0) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
//         <Alert className="max-w-md">
//           <AlertCircle className="h-4 w-4" />
//           <AlertTitle>No Access</AlertTitle>
//           <AlertDescription>
//             You don&apos;t have permission to access any tabs. Contact your administrator.
//           </AlertDescription>
//           <Button onClick={handleLogout} className="mt-4" size="sm">
//             Logout
//           </Button>
//         </Alert>
//       </div>
//     );
//   }

//   // Get active tab component
//   const ActiveTabComponent = activeTab ? accessibleTabs.find((t) => t.id === activeTab)?.component : null;

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <header className="bg-white shadow-sm border-b">
//         <div className="px-4 py-3 flex items-center justify-between">
//           <div className="flex items-center space-x-4">
//             <div className="bg-blue-500 text-white w-10 h-10 rounded-lg flex items-center justify-center">
//               <Store className="w-6 h-6" />
//             </div>
//             <div>
//               <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
//               <p className="text-sm text-gray-600">Consumer Store Management</p>
//             </div>
//           </div>
//           <div className="flex items-center space-x-4">
//             <Button variant="outline" size="sm">
//               <Bell className="w-4 h-4 sm:mr-2" />
//               <span className="hidden sm:inline">Notifications</span>
//             </Button>
//             <Button onClick={handleLogout} variant="destructive" size="sm">
//               <LogOut className="w-4 h-4 sm:mr-2" />
//               <span className="hidden sm:inline">Logout</span>
//             </Button>
//           </div>
//         </div>
//       </header>

//       {/* Tabs Navigation */}
//       <nav className="bg-white border-b sticky top-0 z-10">
//         <div className="px-6 flex space-x-8 overflow-x-auto">
//           {accessibleTabs.map((tab) => {
//             const Icon = tab.icon;
//             const isActive = activeTab === tab.id;
//             return (
//               <button
//                 key={tab.id}
//                 onClick={() => handleTabChange(tab.id)}
//                 className={`py-3 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
//                   isActive
//                     ? 'border-blue-500 text-blue-600'
//                     : 'border-transparent text-gray-500 hover:text-blue-600'
//                 }`}
//               >
//                 {/* <Icon className="w-4 h-4" /> */}
//                 <span>{tab.label}</span>
//               </button>
//             );
//           })}
//         </div>
//       </nav>

//       {/* Tab Content */}
//       <main className="p-6">
//         {ActiveTabComponent && <ActiveTabComponent />}
//       </main>
//     </div>
//   );
// }