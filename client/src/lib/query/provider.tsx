"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getQueryClient } from "./client";

/**
 * Mounted once in `AppProviders`, above everything.
 *
 * App-wide rather than per-route because the cache is app-wide: the header's
 * cart badge renders on every page, and it has to read the same entry the
 * cart page writes to. A provider scoped to `/cart` would give them separate
 * caches and the badge would go stale the moment the shopper navigated away.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
