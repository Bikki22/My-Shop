"use client";

import { useRef, type ChangeEvent } from "react";
import Image from "next/image";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isOptimizableImage } from "@/config/images";
import { useProductImages } from "../hooks/use-product-mutations";
import { PRODUCT_LIMITS } from "../types";

/**
 * Photo management for an existing listing.
 *
 * Separate from `ProductForm` because it talks to different endpoints
 * (`POST /products/:id/images`, `PATCH /products/:id/images/remove`) and,
 * more importantly, because it writes immediately rather than on submit —
 * the assets live in Cloudinary, so adding one is a real upload and removing
 * one deletes the file behind it. Batching those into a form's Save would
 * mean a cancelled edit had already changed what is stored.
 *
 * The server caps uploads at 8 files of 5MB each and checks the real bytes;
 * the `accept` and the count check here only save an obviously doomed round
 * trip.
 */
export function ProductImageManager({
  productId,
  images,
}: {
  productId: string;
  images: readonly string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, remove, isPending } = useProductImages(productId);

  const remaining = PRODUCT_LIMITS.imagesMax - images.length;

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    // Reset first, so picking the same file twice in a row still fires a
    // change event.
    event.target.value = "";
    if (files.length > 0) {
      await upload(files);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-base font-medium">Photos</h2>
        <p className="text-xs text-muted-foreground">
          {images.length} of {PRODUCT_LIMITS.imagesMax} used
        </p>
      </div>

      {images.length === 0 ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          This listing has no photos.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((url) => (
            <li
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10"
            >
              {/* `next/image` throws on a host that is not in the remote
                  patterns allow-list, which would take the whole page down
                  over one bad URL. A plain img is the safe fallback. */}
              {isOptimizableImage(url) ? (
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className="object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="size-full object-cover" />
              )}

              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending || images.length <= PRODUCT_LIMITS.imagesMin}
                onClick={() => void remove(url)}
                className="absolute right-1.5 bottom-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2Icon />
                <span className="sr-only">Remove photo</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={(event) => void onPick(event)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending || remaining <= 0}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon />
          {isPending ? "Uploading…" : "Add photos"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {remaining <= 0
            ? "This listing is at the photo limit."
            : `Up to ${String(remaining)} more, 5MB each. JPEG, PNG, WebP or AVIF.`}
        </p>
      </div>

      {images.length <= PRODUCT_LIMITS.imagesMin ? (
        <p className="text-xs text-muted-foreground">
          A listing must keep at least one photo, so the last one cannot be
          removed — replace it by adding another first.
        </p>
      ) : null}
    </section>
  );
}
