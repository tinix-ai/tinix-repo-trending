"use client";

import { useState, useEffect } from "react";
import type { RankedProject } from "@/types";

const STORAGE_KEY = "tinix-comparison-projects";
const EVENT_NAME = "tinix-comparison-change";

export function useComparison() {
  const [selectedProjects, setSelectedProjects] = useState<RankedProject[]>([]);

  useEffect(() => {
    const loadSaved = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setSelectedProjects(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse saved projects", e);
        }
      } else {
        setSelectedProjects([]);
      }
    };

    loadSaved();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadSaved();
      }
    };

    const handleCustomChange = () => {
      loadSaved();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(EVENT_NAME, handleCustomChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(EVENT_NAME, handleCustomChange);
    };
  }, []);

  const addProject = (project: RankedProject) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const list: RankedProject[] = saved ? JSON.parse(saved) : [];
    if (list.length >= 10) {
      return false;
    }
    if (!list.some((p) => p.id === project.id)) {
      list.push(project);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event(EVENT_NAME));
    }
    return true;
  };

  const removeProject = (projectId: string) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let list: RankedProject[] = saved ? JSON.parse(saved) : [];
    list = list.filter((p) => p.id !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  const clearProjects = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  return {
    selectedProjects,
    addProject,
    removeProject,
    clearProjects,
    isMaxReached: selectedProjects.length >= 10,
  };
}
