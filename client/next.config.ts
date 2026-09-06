import type { NextConfig } from "next";
import { imageRemotePatterns } from "./src/config/images";

const nextConfig: NextConfig = {
  // Typed `Link` hrefs and typed `PageProps`/`LayoutProps` helpers.
  typedRoutes: true,

  images: {
    // Product photos come from the API's Cloudinary account; the rest are
    // the placeholder hosts demo data tends to use. See `config/images.ts`,
    // which `ProductImage` reads to avoid rendering an unlisted host.
    remotePatterns: imageRemotePatterns,
  },

  experimental: {
    // Required by `forbidden()` / `unauthorized()`, which the role guards in
    // `src/features/auth/server/guards.ts` use to render 403 pages.
    authInterrupts: true,
  },
};

export default nextConfig;
