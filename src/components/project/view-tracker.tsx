"use client";

import { useEffect } from "react";
import { incrementProjectViews } from "@/app/actions";

interface ViewTrackerProps {
  projectId: string;
}

export function ViewTracker({ projectId }: ViewTrackerProps) {
  useEffect(() => {
    if (!projectId) return;
    
    const key = `viewed_${projectId}`;
    const lastViewed = localStorage.getItem(key);
    const now = Date.now();
    
    // Check if the project was viewed in the last 2 hours
    if (!lastViewed || now - parseInt(lastViewed, 10) > 2 * 60 * 60 * 1000) {
      incrementProjectViews(projectId).then((res) => {
        if (res.success) {
          localStorage.setItem(key, now.toString());
        }
      });
    }
  }, [projectId]);

  return null;
}
