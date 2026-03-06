"use client";

import { useState } from "react";
import { User } from "@/types/user";
import { TABS_REGISTRY } from "@/lib/config/tabs-registry";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Users, ShieldCheck, User as UserIcon } from "lucide-react";
import EditUserModal from "@/components/modals/edit-user-modal";
import ConfirmDialog from "../dialogs/ConfirmDialog";

interface UserListProps {
  users: User[];
  isLoading?: boolean;
  onUserDeleted?: (userId: string) => void;
  onUserEdited?: (updatedUser: User) => void;
}

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  staff: {
    label: "Staff",
    icon: UserIcon,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
} as const;

export default function UserList({
  users,
  isLoading = false,
  onUserDeleted,
  onUserEdited,
}: UserListProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingUserId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingUserId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success("User deleted successfully");
      onUserDeleted?.(deletingUserId);
      setDeletingUserId(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setDeletingUserId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Existing Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Existing Users
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">
              {users.length} {users.length === 1 ? "user" : "users"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No users yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add a user using the form above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 w-[160px]">Username</TableHead>
                  <TableHead className="w-[100px]">Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="pr-6 w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const roleConfig =
                    ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.staff;
                  const RoleIcon = roleConfig.icon;

                  return (
                    <TableRow key={user._id} className="group">
                      {/* Username */}
                      <TableCell className="pl-6 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground uppercase shrink-0">
                            {user.username.charAt(0)}
                          </div>
                          {user.username}
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs gap-1 font-medium ${roleConfig.className}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {roleConfig.label}
                        </Badge>
                      </TableCell>

                      {/* Permissions */}
                      <TableCell>
                        {user.allowedTabs && user.allowedTabs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.allowedTabs.map((tabId) => (
                              <Badge
                                key={tabId}
                                variant="secondary"
                                className="text-xs capitalize font-normal"
                              >
                                {TABS_REGISTRY[tabId as keyof typeof TABS_REGISTRY]
                                  ?.label ?? tabId}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No permissions
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-6 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingUserId(user._id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EditUserModal
        user={editingUser}
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        onUserUpdated={(updated) => {
          onUserEdited?.(updated);
          setEditingUser(null);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingUserId}
        onOpenChange={(v) => !v && setDeletingUserId(null)}
        title="Delete User"
        description="This action cannot be undone. The user will be permanently removed."
        icon={Trash2}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        loadingLabel="Deleting..."
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}


// "use client";

// import { User } from "@/types/user";
// import UserListItem from "../parts/UserListItem";
// import { toast } from "sonner";

// interface UserListProps {
//   users: User[];
//   isLoading?: boolean;
//   onUserDeleted?: (userId: string) => void;
//   onUserEdited?: (updatedUser: User) => void;
// }

// export default function UserList({ 
//   users, 
//   isLoading = false,
//   onUserDeleted,
//   onUserEdited 
// }: UserListProps) {
//   const handleEdit = (user: User) => {
//     if (onUserEdited) {
//       // TODO: Implement actual edit logic (e.g., open modal/form)
//       // For now, just show a toast
//       toast.info("Edit functionality not implemented.", {
//         description: `You clicked edit for user: ${user.username}`
//       });
//     }
//   };

//   const handleDelete = async (userId: string) => {
//     if (onUserDeleted) {
//       try {
//         // TODO: Implement actual API call
//         // const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
//         // if (response.ok) {
//         //   onUserDeleted(userId);
//         //   toast.success("User deleted successfully");
//         // }
        
//         toast.warning("Delete functionality not implemented.", {
//           description: `You clicked delete for user ID: ${userId}`
//         });
//       } catch (error) {
//         toast.error("Failed to delete user");
//       }
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="space-y-4">
//         <h2 className="text-2xl font-bold">Existing Users</h2>
//         <div className="text-center p-8 border-2 border-dashed rounded-lg">
//           <p className="text-sm text-muted-foreground">Loading users...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-4">
//       <h2 className="text-2xl font-bold">Existing Users</h2>
//       {users.length > 0 ? (
//         <div className="grid gap-4">
//           {users.map((user) => (
//             <UserListItem 
//               key={user._id} 
//               user={user} 
//               onEdit={handleEdit} 
//               onDelete={handleDelete} 
//             />
//           ))}
//         </div>
//       ) : (
//         <div className="text-center p-8 border-2 border-dashed rounded-lg">
//           <p className="text-sm text-muted-foreground">
//             No users created yet. Use the form above to add a new user.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }


// // "use client";

// // import { User } from "@/types/user";
// // import UserListItem from "../parts/UserListItem";
// // import { toast } from "sonner";

// // interface UserListProps {
// //   users: User[];
// // }

// // export default function UserList({ users }: UserListProps) {
// //   const handleEdit = (user: User) => {
// //     toast.info("Edit functionality not implemented.", {
// //       description: `You clicked edit for user: ${user.username}`
// //     });
// //   };

// //   const handleDelete = (userId: string) => {
// //     toast.warning("Delete functionality not implemented.", {
// //       description: `You clicked delete for user ID: ${userId}`
// //     });
// //   };

// //   return (
// //     <div className="space-y-4">
// //       <h2 className="text-2xl font-bold">Existing Users</h2>
// //       {users.length > 0 ? (
// //         <div className="grid gap-4">
// //           {users.map((user) => (
// //             <UserListItem 
// //               key={user._id} 
// //               user={user} 
// //               onEdit={handleEdit} 
// //               onDelete={handleDelete} 
// //             />
// //           ))}
// //         </div>
// //       ) : (
// //         <div className="text-center p-8 border-2 border-dashed rounded-lg">
// //           <p className="text-sm text-muted-foreground">
// //             No users created yet. Use the form above to add a new user.
// //           </p>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }