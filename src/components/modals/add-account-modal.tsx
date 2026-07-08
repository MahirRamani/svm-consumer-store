// components/modals/add-account-modal.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wallet, Users } from "lucide-react";
import { toast } from "sonner";
import { useCreateAccount } from "@/hooks/use-account-mutations";
import type { AccountFormErrors } from "@/types/admin/account";

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
  ownerId: string;
}

const initialFormData: FormData = {
  name: "",
  description: "",
  isActive: true,
  ownerId: "",
};

export default function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const createMutation = useCreateAccount();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<AccountFormErrors & { ownerId?: string }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Fetch users
  const { data: usersResponse } = useQuery<{
    success: boolean;
    data: { users: { _id: string; name: string; email: string; username?: string }[] };
  }>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/users?limit=100");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: open,
  });

  const users = usersResponse?.data?.users || [];

  // Reset on close
  useEffect(() => {
    if (!open) {
      setFormData(initialFormData);
      setErrors({});
      setTouched({});
    }
  }, [open]);

  const validateForm = useCallback((): boolean => {
    const newErrors: AccountFormErrors & { ownerId?: string } = {};

    if (!formData.ownerId) {
      newErrors.ownerId = "Please select a user";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Account name is required";
    } else if (formData.name.length > 100) {
      newErrors.name = "Name cannot exceed 100 characters";
    }

    if (formData.description.length > 500) {
      newErrors.description = "Description cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [touched]);

  const handleBlur = useCallback((field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ ownerId: true, name: true, description: true });

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    createMutation.mutate(
      {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
        ownerId: formData.ownerId,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  }, [formData, validateForm, createMutation, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, onOpenChange]);

  const isSubmitting = createMutation.isPending;
  const isFormValid = formData.ownerId && formData.name.trim() && !errors.name && !errors.ownerId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-500" />
            Create Account for User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Selection - REQUIRED */}
          <div className="space-y-2">
            <Label htmlFor="ownerId" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Select User <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.ownerId}
              onValueChange={(value) => handleChange("ownerId", value)}
            >
              <SelectTrigger className={errors.ownerId && touched.ownerId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    @{user.username || user.email?.split("@")[0]} - {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.ownerId && touched.ownerId && (
              <p className="text-sm text-destructive">{errors.ownerId}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Account Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="e.g., Personal Cash, Shop Account"
              className={errors.name && touched.name ? "border-destructive" : ""}
            />
            {errors.name && touched.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Optional description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="isActive">Active Account</Label>
              <p className="text-sm text-muted-foreground">
                Inactive accounts are hidden from user
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleChange("isActive", checked)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}





// "use client";

// import { useState, useCallback, useEffect } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Switch } from "@/components/ui/switch";
// import { Loader2, Wallet } from "lucide-react";
// import { toast } from "sonner";
// import { useCreateAccount } from "@/hooks/use-account-mutations";

// interface AddAccountModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
// }

// interface FormData {
//   name: string;
//   description: string;
//   isActive: boolean;
// }

// interface FormErrors {
//   name?: string;
//   description?: string;
// }

// const initialFormData: FormData = {
//   name: "",
//   description: "",
//   isActive: true,
// };

// export default function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
//   const createMutation = useCreateAccount();

//   const [formData, setFormData] = useState<FormData>(initialFormData);
//   const [errors, setErrors] = useState<FormErrors>({});
//   const [touched, setTouched] = useState<Record<string, boolean>>({});

//   // Reset on close
//   useEffect(() => {
//     if (!open) {
//       setFormData(initialFormData);
//       setErrors({});
//       setTouched({});
//     }
//   }, [open]);

//   const validateForm = useCallback((): boolean => {
//     const newErrors: FormErrors = {};

//     if (!formData.name.trim()) {
//       newErrors.name = "Account name is required";
//     } else if (formData.name.length > 100) {
//       newErrors.name = "Name cannot exceed 100 characters";
//     }

//     if (formData.description.length > 500) {
//       newErrors.description = "Description cannot exceed 500 characters";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   }, [formData]);

//   const handleChange = useCallback((field: keyof FormData, value: string | boolean) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
    
//     // Clear error on change if touched
//     if (touched[field]) {
//       setErrors((prev) => ({ ...prev, [field]: undefined }));
//     }
//   }, [touched]);

//   const handleBlur = useCallback((field: keyof FormData) => {
//     setTouched((prev) => ({ ...prev, [field]: true }));
//   }, []);

//   const handleSubmit = useCallback(async (e: React.FormEvent) => {
//     e.preventDefault();

//     setTouched({ name: true, description: true });

//     if (!validateForm()) {
//       toast.error("Please fix the form errors");
//       return;
//     }

//     createMutation.mutate(
//       {
//         name: formData.name.trim(),
//         description: formData.description.trim() || undefined,
//         isActive: formData.isActive,
//       },
//       {
//         onSuccess: () => onOpenChange(false),
//       }
//     );
//   }, [formData, validateForm, createMutation, onOpenChange]);

//   const handleClose = useCallback(() => {
//     if (!createMutation.isPending) {
//       onOpenChange(false);
//     }
//   }, [createMutation.isPending, onOpenChange]);

//   const isSubmitting = createMutation.isPending;
//   const isFormValid = formData.name.trim() && !errors.name;

//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="max-w-md">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <Wallet className="w-5 h-5 text-blue-500" />
//             Add New Account
//           </DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           {/* Name */}
//           <div className="space-y-2">
//             <Label htmlFor="name">
//               Account Name <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="name"
//               value={formData.name}
//               onChange={(e) => handleChange("name", e.target.value)}
//               onBlur={() => handleBlur("name")}
//               placeholder="e.g., Personal Cash, Shop Account"
//               className={errors.name && touched.name ? "border-destructive" : ""}
//             />
//             {errors.name && touched.name && (
//               <p className="text-sm text-destructive">{errors.name}</p>
//             )}
//           </div>

//           {/* Description */}
//           <div className="space-y-2">
//             <Label htmlFor="description">Description</Label>
//             <Textarea
//               id="description"
//               value={formData.description}
//               onChange={(e) => handleChange("description", e.target.value)}
//               onBlur={() => handleBlur("description")}
//               placeholder="Optional description"
//               rows={3}
//               className={errors.description ? "border-destructive" : ""}
//             />
//             {errors.description && touched.description && (
//               <p className="text-sm text-destructive">{errors.description}</p>
//             )}
//           </div>

//           {/* Active Toggle */}
//           <div className="flex items-center justify-between py-2">
//             <div>
//               <Label htmlFor="isActive">Active Account</Label>
//               <p className="text-sm text-muted-foreground">
//                 Inactive accounts are hidden from forms
//               </p>
//             </div>
//             <Switch
//               id="isActive"
//               checked={formData.isActive}
//               onCheckedChange={(checked) => handleChange("isActive", checked)}
//             />
//           </div>

//           {/* Actions */}
//           <div className="flex gap-3 pt-4 border-t">
//             <Button
//               type="submit"
//               disabled={isSubmitting || !isFormValid}
//               className="flex-1"
//             >
//               {isSubmitting ? (
//                 <>
//                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                   Creating...
//                 </>
//               ) : (
//                 "Create Account"
//               )}
//             </Button>
//             <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }