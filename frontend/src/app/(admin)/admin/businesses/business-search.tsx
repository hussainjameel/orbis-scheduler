"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Same controlled-input/URL-sync pattern as owner bookings' booking-search.tsx
// (the defaultValue-vs-controlled fix), applied fresh here rather than copied
// with a find-replace, per instruction to get it right the first time.
export function BusinessSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";

  const [value, setValue] = useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);

  // Resyncs the field whenever the URL's search param changes from outside
  // this component — a status-pill click, browser back/forward, or a direct
  // URL edit — so the box never shows stale text.
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    setValue(urlSearch);
  }

  function navigate(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue) {
      params.set("search", nextValue);
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(value.trim());
  }

  function handleClear() {
    setValue("");
    navigate("");
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full sm:w-64">
      <Input
        type="text"
        name="search"
        placeholder="Search business or owner email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={value ? "pr-8" : undefined}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted hover:text-text-secondary"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  );
}
