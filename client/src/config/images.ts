/**
 * Hosts `next/image` is allowed to optimize.
 *
 * `next.config.ts` turns this list into `images.remotePatterns`, and
 * `ProductImage` checks against it before choosing the optimized
 * component — a `<Image>` pointed at an unlisted host throws while
 * rendering, which would take a whole product page down over one bad
 * seed row. Keeping both readers on one list is what stops them drifting.
 */
export const IMAGE_HOSTS = [
  // Where the API uploads product and shop images.
  "res.cloudinary.com",
  // Common sources for seeded/demo catalogue rows.
  "images.unsplash.com",
  "picsum.photos",
  "placehold.co",
] as const;

export const imageRemotePatterns = IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));

/** Whether `next/image` can handle this src, or a plain `<img>` must. */
export function isOptimizableImage(src: string): boolean {
  try {
    const { protocol, hostname } = new URL(src);
    return (
      protocol === "https:" && IMAGE_HOSTS.includes(hostname as (typeof IMAGE_HOSTS)[number])
    );
  } catch {
    // Not an absolute URL — a relative path is served from this app and is
    // always optimizable.
    return src.startsWith("/");
  }
}
