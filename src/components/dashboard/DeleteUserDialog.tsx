import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteUserDialogProps {
  username: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
}

export function DeleteUserDialog({ username, onConfirm, trigger }: DeleteUserDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <button
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-white/[0.06] text-muted-foreground hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10 transition-colors"
            title="Delete user"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            Are you sure you want to delete user{" "}
            <span className="font-semibold text-foreground">{username}</span>?
            They will lose access to the dashboard immediately.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 mt-0 sm:mt-0"
          >
            Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}