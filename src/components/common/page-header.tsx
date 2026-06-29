import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("text-center mb-12 mt-6 md:mt-10", className)}>
      {children && <div className="mb-4">{children}</div>}
      <h1 
        className={cn(
          "text-3xl md:text-[32px] font-bold tracking-tight text-[var(--color-ink)] mb-3 leading-tight",
          titleClassName
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p 
          className={cn(
            "text-[15px] md:text-base text-[var(--color-ink-muted-80)] max-w-2xl mx-auto leading-relaxed",
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
