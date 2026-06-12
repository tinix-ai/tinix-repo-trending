"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  prefix = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery("");
        }}
        className="flex h-9 items-center justify-between gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm outline-none transition-colors hover:border-[var(--color-action-blue)] min-w-[160px] max-w-full"
      >
        <span className={`truncate max-w-[140px] sm:max-w-[200px] ${value ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted-80)]"}`}>
          {value ? `${prefix}${value}` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-ink-muted-48)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
            <Search className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              }}
              className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-action-blue)] hover:text-white transition-colors"
            >
              <span>{placeholder}</span>
              {!value && <Check className="h-4 w-4 text-[var(--color-action-blue)] group-hover:text-white" />}
            </button>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--color-ink-muted-80)]">
                No results found.
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-action-blue)] hover:text-white transition-colors mt-0.5"
                >
                  <span className="truncate">{prefix}{opt}</span>
                  {value === opt && <Check className="h-4 w-4 text-[var(--color-action-blue)] group-hover:text-white" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
