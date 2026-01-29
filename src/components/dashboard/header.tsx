"use client";

import { Button } from "@/components/ui/button";
import { Store, Bell, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
// import { useAuthStore } from "@/lib/store/auth-store";

/**
 * A dedicated header component for the admin dashboard.
 * It handles its own logic, like logout.
 */
export default function AdminHeader() {
  const router = useRouter();
//   const { logout } = useAuthStore();

  const handleLogout = () => {
    // logout();
    router.push("/login");
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 py-2 flex items-center justify-between">
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
          <Button variant="outline" className="text-gray-600 bg-transparent">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </Button>
          <Button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
