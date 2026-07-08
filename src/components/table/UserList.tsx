"use client";

import { useState } from "react";
import { User, AppRole } from "@/types/user";
import { TABS_REGISTRY } from "@/lib/config/tabs-registry";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Edit, Trash2, Users,
  Crown, ShieldCheck, Calculator, Tag,
} from "lucide-react";
import EditUserModal from "@/components/modals/edit-user-modal";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiResponse } from "@/lib/api/base-handler";

interface UserListProps {
  users: User[];
  isLoading?: boolean;
}

// ✅ Keys are uppercase — exactly matching AppRole and DB values
const ROLE_CONFIG: Record<
  AppRole,
  { label: string; icon: React.ElementType; className: string }
> = {
  SUPERUSER: {
    label: "Superuser",
    icon: Crown,
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  ADMIN: {
    label: "Admin",
    icon: ShieldCheck,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  ACCOUNTANT: {
    label: "Accountant",
    icon: Calculator,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  SELLER: {
    label: "Seller",
    icon: Tag,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

const DEFAULT_ROLE_CONFIG = {
  label: "Unknown",
  icon: ShieldCheck,
  className: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function UserList({ users, isLoading = false }: UserListProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const deleteUserMutation = useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (userId) => {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const result: ApiResponse<null> = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Failed to delete user");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
      setDeletingUserId(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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
      <Card className="gap-1">
        <CardHeader className="pb-1">
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
                  <TableHead className="w-[130px]">Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="pr-6 w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const roleConfig = ROLE_CONFIG[user.role] ?? DEFAULT_ROLE_CONFIG;
                  const RoleIcon = roleConfig.icon;

                  return (
                    <TableRow key={user._id} className="group">
                      {/* Username */}
                      <TableCell className="pl-6 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground uppercase shrink-0">
                            {user.username?.charAt(0)}
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
                                {TABS_REGISTRY[tabId as keyof typeof TABS_REGISTRY]?.label ?? tabId}
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
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
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

      {editingUser && (
        <EditUserModal
          key={editingUser._id}
          user={editingUser}
          open={true}
          onClose={() => setEditingUser(null)}
          onUserUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            setEditingUser(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingUserId}
        onOpenChange={(v) => !v && setDeletingUserId(null)}
        title="Delete User"
        description="This action cannot be undone. The user will be permanently removed."
        icon={Trash2}
        confirmLabel="Delete"
        variant="destructive"
        loadingLabel="Deleting..."
        onConfirm={() => deleteUserMutation.mutate(deletingUserId!)}
        isLoading={deleteUserMutation.isPending}
      />
    </>
  );
}