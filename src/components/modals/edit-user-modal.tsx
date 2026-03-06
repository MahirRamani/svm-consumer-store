"use client";

import { useState, useEffect } from "react";
import { User } from "@/types/user";
import { TABS_REGISTRY } from "@/lib/config/tabs-registry";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface EditUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

const ALL_TABS = Object.entries(TABS_REGISTRY) as [string, { label: string }][];

export default function EditUserModal({
  user,
  open,
  onClose,
  onUserUpdated,
}: EditUserModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync form state when user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setPassword("");
      setRole(user.role as "admin" | "staff");
      setAllowedTabs(user.allowedTabs ?? []);
    }
  }, [user]);

  const toggleTab = (tabId: string) => {
    setAllowedTabs((prev) =>
      prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        username: username.trim(),
        role,
        allowedTabs,
      };
      if (password) body.password = password;

      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to update user");
      }

      toast.success("User updated successfully");
      onUserUpdated(json.data);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit User</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              New Password{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (leave blank to keep current)
              </span>
            </Label>
            <div className="relative">
              <Input
                id="password"
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
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "staff")}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Tab Permissions</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 bg-muted/30">
              {ALL_TABS.map(([tabId, { label }]) => (
                <label
                  key={tabId}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <Checkbox
                    checked={allowedTabs.includes(tabId)}
                    onCheckedChange={() => toggleTab(tabId)}
                  />
                  <span className="text-sm group-hover:text-foreground transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {allowedTabs.length} of {ALL_TABS.length} tabs selected
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}