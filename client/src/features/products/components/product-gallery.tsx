"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

/**
 * The product page's photos: one large frame plus thumbnails.
 *
 * Thumbnails are buttons rather than a scroll-snap carousel so the whole
 * set is reachable by keyboard and every image keeps a stable position —
 * on a product page, "show me the third photo again" is a common move.
 */
export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10">
        <ProductImage
          // Re-keyed so a switch is a fresh element, not a swapped `src`
          // that would briefly show the old photo at the new one's size.
          key={current ?? "empty"}
          src={current}
          alt={name}
          sizes="(min-width: 1024px) 560px, 92vw"
          preload
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div
          role="group"
          aria-label={`${name} photos`}
          className="grid grid-cols-5 gap-2 sm:grid-cols-6"
        >
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => {
                setActive(index);
              }}
              aria-label={`Show photo ${String(index + 1)} of ${String(images.length)}`}
              aria-pressed={index === active}
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg bg-muted outline-none transition-all",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                index === active
                  ? "ring-2 ring-foreground"
                  : "opacity-70 ring-1 ring-foreground/10 hover:opacity-100",
              )}
            >
              <ProductImage
                src={image}
                alt=""
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
