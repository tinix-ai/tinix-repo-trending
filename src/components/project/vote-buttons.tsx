"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/routing";

interface VoteButtonsProps {
  projectId: string;
}

export function VoteButtons({ projectId }: VoteButtonsProps) {
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userVote, setUserVote] = useState<"like" | "dislike" | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/vote`)
      .then((res) => res.json())
      .then((data) => {
        setLikes(data.likes || 0);
        setDislikes(data.dislikes || 0);
        setUserVote(data.userVote || null);
      })
      .catch((err) => console.error("Error fetching votes", err));
  }, [projectId]);

  const handleVote = async (type: "like" | "dislike") => {
    if (loading) return;
    setLoading(true);
    setAuthError(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType: type }),
      });

      if (res.status === 401) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        // Refresh counts
        const voteRes = await fetch(`/api/projects/${projectId}/vote`);
        const voteData = await voteRes.json();
        setLikes(voteData.likes || 0);
        setDislikes(voteData.dislikes || 0);
        setUserVote(voteData.userVote || null);
      }
    } catch (err) {
      console.error("Error voting", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-xl p-1 w-fit shadow-sm">
        {/* Like Button */}
        <button
          onClick={() => handleVote("like")}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:bg-[var(--color-canvas)] active:scale-[0.95] ${
            userVote === "like"
              ? "text-[var(--color-action-blue)] bg-[var(--color-action-blue)]/5 border border-[var(--color-action-blue)]/20"
              : "text-[var(--color-ink-muted-80)] border border-transparent"
          }`}
        >
          <ThumbsUp size={14} className={userVote === "like" ? "fill-[var(--color-action-blue)]/10" : ""} />
          <span>{likes}</span>
        </button>

        <div className="h-4 w-px bg-[var(--color-divider-soft)]" />

        {/* Dislike Button */}
        <button
          onClick={() => handleVote("dislike")}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:bg-[var(--color-canvas)] active:scale-[0.95] ${
            userVote === "dislike"
              ? "text-red-500 bg-red-500/5 border border-red-500/20"
              : "text-[var(--color-ink-muted-80)] border border-transparent"
          }`}
        >
          <ThumbsDown size={14} className={userVote === "dislike" ? "fill-red-500/10" : ""} />
          <span>{dislikes}</span>
        </button>
      </div>

      {authError && (
        <div className="absolute top-[100%] left-0 mt-1.5 z-20 flex items-center gap-1.5 p-2.5 bg-[var(--color-bg-secondary)] border border-red-500/20 rounded-xl shadow-lg text-[11px] text-red-500 animate-fade-in whitespace-nowrap">
          <ShieldAlert size={13} className="shrink-0" />
          <span>
            Vui lòng{" "}
            <Link
              href="/login"
              className="underline font-bold text-[var(--color-action-blue)]"
            >
              Đăng nhập
            </Link>{" "}
            để bình chọn
          </span>
        </div>
      )}
    </div>
  );
}
