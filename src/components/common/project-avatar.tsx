"use client";

import { useState } from "react";
import clsx from "clsx";

interface ProjectAvatarProps {
  src?: string;
  name: string;
  className?: string;
  size?: number;
}

export function ProjectAvatar({ src, name, className, size = 48 }: ProjectAvatarProps) {
  const [error, setError] = useState(false);

  // Generate initials (use last part of slash-separated names, e.g. owner/repo -> repo)
  const displayName = name || "";
  const part = displayName.split("/").pop() || displayName;
  const initials = part ? part.substring(0, 2).toUpperCase() : "?";

  // Get a stable color gradient based on the name hash
  const getGradientClass = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "from-blue-500 to-cyan-600 text-white",
      "from-emerald-500 to-teal-600 text-white",
      "from-orange-500 to-red-600 text-white",
      "from-pink-500 to-rose-600 text-white",
      "from-cyan-500 to-blue-600 text-white",
      "from-teal-500 to-emerald-600 text-white",
      "from-amber-500 to-orange-600 text-white",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const gradient = getGradientClass(displayName);

  if (src && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        className={clsx(
          "rounded-xl shadow-sm border border-[var(--color-divider-soft)] object-cover shrink-0 select-none",
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl shadow-sm border border-[var(--color-divider-soft)] flex items-center justify-center font-bold tracking-wider shrink-0 bg-gradient-to-br select-none",
        gradient,
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size > 32 ? `${Math.floor(size * 0.36)}px` : `${Math.floor(size * 0.42)}px`,
      }}
    >
      {initials}
    </div>
  );
}
