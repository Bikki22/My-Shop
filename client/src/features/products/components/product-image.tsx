import Image from "next/image";
import { ImageOffIcon } from "lucide-react";
import { isOptimizableImage } from "@/config/images";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  /**
   * Nullable as well as optional: a cart line and an order item both carry
   * `image: string | null` straight from the API.
   */
  src: string | null | undefined;
  alt: string;
  /** Passed straight to `next/image`; required because every use is `fill`. */
  sizes: string;
  className?: string;
  /** Preloads the image. Reserve it for the one above-the-fold hero. */
  preload?: boolean;
}

/**
 * A product photo that fills its (positioned) parent.
 *
 * Catalogue rows carry whatever URL the merchant uploaded, and `next/image`
 * throws at render time on a host that is not in `remotePatterns` — one bad
 * row would otherwise take the page down. So anything off the allowlist
 * falls back to a plain `<img>`: unoptimized, but rendered.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  className,
  preload = false,
}: ProductImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOffIcon className="size-6" aria-hidden />
        <span className="sr-only">No image</span>
      </div>
    );
  }

  if (!isOptimizableImage(src)) {
    return (
      // The host is not in `images.remotePatterns`, so `next/image` cannot
      // serve this URL at all.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={preload ? "eager" : "lazy"}
        decoding="async"
        className={cn("absolute inset-0 h-full w-full", className)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      className={className}
    />
  );
}
