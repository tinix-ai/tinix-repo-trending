"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Tag, ChevronDown, ChevronUp } from "lucide-react";

interface TopicsListProps {
  topics: string[];
  showMoreLabel: string;
  showLessLabel: string;
}

export function TopicsList({ topics, showMoreLabel, showLessLabel }: TopicsListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!topics || topics.length === 0) return null;

  const uniqueTopics = Array.from(new Set(topics));
  const visibleTopics = isExpanded ? uniqueTopics : uniqueTopics.slice(0, 10);
  const hasMore = uniqueTopics.length > 10;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-2.5">
        {visibleTopics.map((topic) => (
          <Link
            key={topic}
            href={`/?tag=${encodeURIComponent(topic)}`}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline cursor-pointer font-medium transition-colors"
          >
            <Tag className="h-3 w-3 shrink-0" />
            <span>#{topic}</span>
          </Link>
        ))}
      </div>
      
      {hasMore && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] font-semibold select-none cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <>
                <span>{showLessLabel}</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>{showMoreLabel} (+{uniqueTopics.length - 10})</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
