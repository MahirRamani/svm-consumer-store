// FILE: components/dashboard/users/UserListItem.tsx
"use client";

import { User } from "@/types/user";
import { TABS_REGISTRY } from "@/lib/config/tabs-registry";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

interface UserListItemProps {
  user: User;
  onDelete: (userId: string) => void;
  onEdit: (user: User) => void;
}

export default function UserListItem({ user, onDelete, onEdit }: UserListItemProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold">{user.username}</h3>
              <Badge variant="outline" className="capitalize">{user.role}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <p className="text-sm text-muted-foreground mr-2">Permissions:</p>
              {user.allowedTabs.map((tabId) => (
                <Badge key={tabId} variant="secondary" className="capitalize">
                  {TABS_REGISTRY[tabId as keyof typeof TABS_REGISTRY]?.label || tabId}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="icon" onClick={() => onEdit(user)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={() => onDelete(user._id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// // FILE: components/dashboard/users/UserListItem.tsx
// "use client";

// import { User } from "@/types/user";
// import { DASHBOARD_TABS } from "@/lib/config/dashboardConfig";
// import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Edit, Trash2 } from "lucide-react";

// interface UserListItemProps {
//   user: User;
//   onDelete: (userId: string) => void;
//   onEdit: (user: User) => void;
// }

// export default function UserListItem({ user, onDelete, onEdit }: UserListItemProps) {
//   return (
//     <Card>
//       <CardContent className="pt-6">
//         <div className="flex justify-between items-start">
//           <div className="space-y-2">
//             <div className="flex items-center space-x-2">
//               <h3 className="font-semibold">{user.username}</h3>
//               <Badge variant="outline" className="capitalize">{user.role}</Badge>
//             </div>
//             <div className="flex flex-wrap items-center gap-1">
//               <p className="text-sm text-muted-foreground mr-2">Permissions:</p>
//               {user.allowedTabs.map((tabId) => (
//                 <Badge key={tabId} variant="secondary" className="capitalize">
//                   {DASHBOARD_TABS[tabId as keyof typeof DASHBOARD_TABS]?.label || tabId}
//                 </Badge>
//               ))}
//             </div>
//           </div>
//           <div className="flex space-x-2">
//             <Button variant="outline" size="icon" onClick={() => onEdit(user)}>
//               <Edit className="w-4 h-4" />
//             </Button>
//             <Button variant="destructive" size="icon" onClick={() => onDelete(user._id)}>
//               <Trash2 className="w-4 h-4" />
//             </Button>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }