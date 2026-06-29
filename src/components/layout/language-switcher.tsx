"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { ChangeEvent, useTransition } from "react";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    startTransition(() => {
      router.replace({ pathname }, { locale: nextLocale });
    });
  }

  return (
    <div className="relative flex items-center">
      <Globe className="absolute left-2 h-4 w-4 text-[var(--color-ink-muted-80)] pointer-events-none" />
      <select
        aria-label="Select language"
        className="h-11 appearance-none bg-transparent pl-8 pr-6 text-sm font-medium text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] transition-colors cursor-pointer outline-none focus:ring-0 disabled:opacity-50"
        defaultValue={locale}
        onChange={onSelectChange}
        disabled={isPending}
      >
        <option value="vi" className="text-black dark:text-white">VI</option>
        <option value="en" className="text-black dark:text-white">EN</option>
      </select>
      <div className="absolute right-2 pointer-events-none">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
