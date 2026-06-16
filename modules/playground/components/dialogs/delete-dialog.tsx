/**
 * Reusable destructive-action confirmation dialog built on AlertDialog. Displays a customizable
 * title, description (supports `{item}` placeholder replaced with `itemName`), and confirm/cancel
 * buttons styled in destructive red. Used by `TemplateNode` in the file explorer for both file
 * and folder deletion — the actual tree mutation happens in the `onConfirm` callback passed by
 * the parent, keeping this component purely presentational.
 */
import * as React from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface DeleteDialogProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  title?: string
  description?: string
  itemName?: string
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export function DeleteDialog({
  isOpen,
  setIsOpen,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,
  onConfirm,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: DeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description.replace("{item}", `"${itemName}"`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}