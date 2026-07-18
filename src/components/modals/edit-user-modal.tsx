"use client";

import { useState } from 'react';
import { User, AppRole } from '@/types/user';
import { ALL_TAB_IDS, TABS_REGISTRY } from '@/lib/config/tabs-registry';
import { ROLES } from '@/lib/config/rolesConfig';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse } from '@/lib/api/base-handler';

interface EditUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

// const ALL_TAB_IDS = Object.entries(TABS_REGISTRY) as [string, { label: string }][];

// ─── Inner form ───────────────────────────────────────────────────────────────
// key={user._id} on this component (set in the shell below) guarantees
// useState initializes fresh from the correct user on every open.

function EditUserForm({
  user,
  onClose,
  onUserUpdated,
}: {
  user: User;
  onClose: () => void;
  onUserUpdated: () => void;
}) {
  // ✅ Direct initialization — no useEffect needed because key remounts this
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AppRole>(user.role);
  const [allowedTabs, setAllowedTabs] = useState<string[]>(user.allowedTabs ?? []);

  const queryClient = useQueryClient();

  const updateUserMutation = useMutation<ApiResponse<User>, Error, Record<string, unknown>>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: ApiResponse<User> = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Failed to update user");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      onUserUpdated();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleTab = (tabId: string) => {
    setAllowedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
  };

  const handleSubmit = () => {
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    const body: Record<string, unknown> = {
      username: username.trim(),
      role,         // ✅ always lowercase e.g. "admin" — matches DB value
      allowedTabs,
    };
    if (password.trim()) body.password = password.trim(); // ✅ only if typed
    updateUserMutation.mutate(body);
  };

  return (
    <>
      <div className="space-y-5 py-2">

        {/* Username */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-username">Username</Label>
          <Input
            id="edit-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="edit-password">
            New Password{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (leave blank to keep current)
            </span>
          </Label>
          <div className="relative">
            <Input
              id="edit-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label>Role</Label>
          {/* ✅ value="admin" matches user.role="admin" from DB — no mismatch */}
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ROLES).map(({ id, name }) => (
                <SelectItem key={id} value={id}>
                  {/* Capitalize for display only */}
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <Label>Tab Permissions</Label>
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/30">
            {ALL_TAB_IDS.map((tabId) => (
              <label key={tabId} className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={allowedTabs.includes(tabId)}
                  onCheckedChange={() => toggleTab(tabId)}
                />
                <span className="text-sm group-hover:text-foreground transition-colors">
                  {TABS_REGISTRY[tabId].label}  {/* ← look up label directly */}
                </span>
              </label>
            ))}
            {/* {ALL_TAB_IDS.map(([tabId, { label }]) => (
              <label key={tabId} className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={allowedTabs.includes(tabId)}
                  onCheckedChange={() => toggleTab(tabId)}
                />
                <span className="text-sm group-hover:text-foreground transition-colors">
                  {label}
                </span>
              </label>
            ))} */}
          </div>
          <p className="text-xs text-muted-foreground">
            {/* {allowedTabs.length} of {ALL_TAB_IDS.length} tabs selected */}
            {allowedTabs.length} of {ALL_TAB_IDS.length} tabs selected
          </p>
        </div>

      </div>

      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={updateUserMutation.isPending}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={updateUserMutation.isPending}>
          {updateUserMutation.isPending && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          Save Changes
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function EditUserModal({
  user,
  open,
  onClose,
  onUserUpdated,
}: EditUserModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit User</DialogTitle>
        </DialogHeader>
        {user && (
          <EditUserForm
            key={user._id}   // ✅ remounts inner form per user — fresh state guaranteed
            user={user}
            onClose={onClose}
            onUserUpdated={onUserUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}