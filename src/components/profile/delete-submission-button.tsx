"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { actionDeleteSubmission } from "@/app/actions";
import { useRouter } from "next/navigation";

export function DeleteSubmissionButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    
    setIsDeleting(true);
    try {
      const res = await actionDeleteSubmission(id);
      if (res.success) {
        toast.success("Submission deleted successfully");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete submission");
      }
    } catch (error) {
      toast.error("Failed to delete submission");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      title="Delete Submission"
    >
      {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
    </button>
  );
}
