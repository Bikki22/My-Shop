"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { routes } from "@/config/routes";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  createProductRequest,
  deleteProductRequest,
  removeProductImageRequest,
  updateProductRequest,
  uploadProductImagesRequest,
} from "../api/product.api";
import { productCache } from "../product-cache";
import type { Product, ProductInput } from "../types";

/**
 * The merchant's writes against `/products`.
 *
 * `useMutation` for the request state, `router.refresh()` for the data — the
 * same split `useCancelOrder` documents. The seller's product list is a
 * Server Component (it is a URL-driven read that also resolves the shop),
 * so there is no client cache entry for it to write into; refreshing the
 * route is what updates the table.
 *
 * The catalogue's own cache *is* invalidated, because a price or stock change
 * makes every cached shopper-facing page of it stale.
 */
function useInvalidateCatalogue() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: productCache.all });
    startTransition(() => {
      router.refresh();
    });
  };

  return { refresh, isRefreshing };
}

/** Reports an API failure as a toast, and anything else as a real error. */
function reportError(error: unknown): void {
  if (isApiError(error)) {
    // "At least one product image is required", "Your shop is suspended" —
    // the rules live on the server and it phrases them better than a
    // client-side guess could.
    toast.error(error.message);
    return;
  }
  throw error;
}

export function useSaveProduct(id?: string) {
  const api = useApi();
  const router = useRouter();
  const { refresh } = useInvalidateCatalogue();

  const mutation = useMutation({
    mutationFn: (input: ProductInput) => {
      const { path, ...options } = id
        ? updateProductRequest(id, input)
        : createProductRequest(input);
      return api<Product>(path, options);
    },

    onSuccess: async (product) => {
      toast.success(id ? "Listing updated" : "Listing published");
      await refresh();
      // A new listing has nowhere to return to, so send the merchant to the
      // edit screen for the thing they just made — where the image uploader
      // lives, which needs an id to attach to.
      router.push(id ? routes.seller.products : routes.seller.product(product._id));
    },

    onError: reportError,
  });

  return {
    save: (input: ProductInput) => mutation.mutateAsync(input).catch(() => null),
    isPending: mutation.isPending,
  };
}

export function useDeleteProduct() {
  const api = useApi();
  const { refresh, isRefreshing } = useInvalidateCatalogue();

  const mutation = useMutation({
    mutationFn: (id: string) => {
      const { path, ...options } = deleteProductRequest(id);
      return api(path, options);
    },
    onSuccess: async () => {
      toast.success("Listing removed");
      await refresh();
    },
    onError: reportError,
  });

  return {
    remove: async (id: string): Promise<boolean> => {
      try {
        await mutation.mutateAsync(id);
        return true;
      } catch {
        // `onError` has already reported it; the caller only needs to know
        // whether to close the dialog.
        return false;
      }
    },
    isPending: mutation.isPending || isRefreshing,
  };
}

/**
 * Photo management, which is a separate endpoint from the listing itself.
 *
 * Images are uploaded to the *existing* product rather than submitted with
 * the form, because the server files them in Cloudinary under the product's
 * id — there is nothing to attach them to until the listing exists. That is
 * why creating a listing lands on its edit screen.
 */
export function useProductImages(id: string) {
  const api = useApi();
  const { refresh, isRefreshing } = useInvalidateCatalogue();

  const upload = useMutation({
    mutationFn: (files: readonly File[]) => {
      const { path, ...options } = uploadProductImagesRequest(id, files);
      return api<Product>(path, options);
    },
    onSuccess: async () => {
      toast.success("Photos added");
      await refresh();
    },
    onError: reportError,
  });

  const remove = useMutation({
    mutationFn: (imageUrl: string) => {
      const { path, ...options } = removeProductImageRequest(id, imageUrl);
      return api<Product>(path, options);
    },
    onSuccess: async () => {
      toast.success("Photo removed");
      await refresh();
    },
    onError: reportError,
  });

  return {
    upload: (files: readonly File[]) =>
      upload.mutateAsync(files).catch(() => null),
    remove: (imageUrl: string) =>
      remove.mutateAsync(imageUrl).catch(() => null),
    isPending: upload.isPending || remove.isPending || isRefreshing,
  };
}
