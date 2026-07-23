"use client";

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
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = "destructive" | "warning" | "info";

const VARIANT_STYLES: Record<
  Variant,
  { icon?: string; actionClass: string; iconClass: string }
> = {
  destructive: {
    actionClass:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    iconClass: "text-destructive",
  },
  warning: {
    actionClass:
      "bg-yellow-500 text-white hover:bg-yellow-600",
    iconClass: "text-yellow-500",
  },
  info: {
    actionClass:
      "bg-blue-600 text-white hover:bg-blue-700",
    iconClass: "text-blue-500",
  },
};

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Content
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;

  // Actions
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;

  // Appearance
  variant?: Variant;
  isLoading?: boolean;
  loadingLabel?: string;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "destructive",
  isLoading = false,
  loadingLabel = "Please wait...",
}: ConfirmDialogProps) {
  const styles = VARIANT_STYLES[variant];

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !isLoading && onOpenChange(v)}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {Icon && <Icon className={cn("w-5 h-5", styles.iconClass)} />}
            {title}
          </AlertDialogTitle>
          {description && (
            <div>{description}</div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={styles.actionClass}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 