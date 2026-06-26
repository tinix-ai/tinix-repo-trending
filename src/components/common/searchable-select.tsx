"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  prefix = "",
  className = "w-[160px]",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalize = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .replace(/\s+/g, "");
  };

  const filteredOptions = options.filter((opt) =>
    normalize(opt).includes(normalize(searchQuery))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const allOptions = ["", ...filteredOptions];

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      dropdownRef.current?.querySelector("button")?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % allOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + allOptions.length) % allOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < allOptions.length) {
        onChange(allOptions[activeIndex]);
        setIsOpen(false);
        setActiveIndex(-1);
        dropdownRef.current?.querySelector("button")?.focus();
      }
    }
  };

  return (
    <div 
      className={`relative ${isOpen ? "z-50" : "z-10"} ${className}`} 
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          setSearchQuery("");
          setActiveIndex(nextOpen ? 0 : -1);
        }}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm outline-none transition-colors hover:border-[var(--color-action-blue)]"
      >
        <span className={`truncate max-w-[140px] sm:max-w-[200px] ${value ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted-80)]"}`}>
          {value ? `${prefix}${value}` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-ink-muted-48)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            <Search className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(0);
              }}
              className="flex-1 bg-transparent text-sm outline-none focus:outline-none focus:ring-0 placeholder:text-[var(--color-ink-muted-80)] text-[var(--color-ink)] border-none ring-0 shadow-none"
              autoFocus
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setActiveIndex(-1);
              }}
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeIndex === 0 
                  ? "bg-[var(--color-action-blue)] text-white" 
                  : "text-[var(--color-ink)] hover:bg-[var(--color-action-blue)] hover:text-white"
              }`}
            >
              <span>{placeholder}</span>
              {!value && <Check className={`h-4 w-4 ${activeIndex === 0 ? "text-white" : "text-[var(--color-action-blue)]"}`} />}
            </button>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--color-ink-muted-80)]">
                No results found.
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const globalIndex = index + 1;
                const isActive = activeIndex === globalIndex;
                const isSelected = value === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setActiveIndex(-1);
                    }}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-0.5 ${
                      isActive 
                        ? "bg-[var(--color-action-blue)] text-white" 
                        : "text-[var(--color-ink)] hover:bg-[var(--color-action-blue)] hover:text-white"
                    }`}
                  >
                    <span className="truncate">{prefix}{opt}</span>
                    {isSelected && <Check className={`h-4 w-4 ${isActive ? "text-white" : "text-[var(--color-action-blue)]"}`} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
