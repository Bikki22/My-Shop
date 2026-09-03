import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Typed `Link` hrefs and typed `PageProps`/`LayoutProps` helpers.
  typedRoutes: true,

  experimental: {
    // Required by `forbidden()` / `unauthorized()`, which the role guards in
    // `src/features/auth/server/guards.ts` use to render 403 pages.
    authInterrupts: true,
  },
};

export default nextConfig;
