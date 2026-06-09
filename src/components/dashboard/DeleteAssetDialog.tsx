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

interface DeleteAssetDialogProps {
  hostname: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
}

export function DeleteAssetDialog({ hostname, onConfirm, trigger }: DeleteAssetDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger || (
          <button
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/[0.06] text-muted-foreground hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10 transition-colors"
            title="Delete asset"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Asset</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{hostname}</span>?
            This will permanently remove all metrics, locations, and error logs.
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
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}