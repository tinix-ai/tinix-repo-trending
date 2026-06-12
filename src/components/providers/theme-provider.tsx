"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import * as React from "react";

// Suppress the React 19 "Encountered a script tag" warning
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) {
      return;
    }
    orig.apply(console, args);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

