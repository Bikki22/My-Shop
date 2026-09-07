"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  createCategoryRequest,
  deleteCategoryRequest,
  updateCategoryRequest,
} from "../api/category.api";
import { categoryCache } from "../category-cache";
import type { Category, CategoryInput } from "../types";

/**
 * Category writes.
 *
 * Both a cache invalidation *and* a route refresh, which is unusual in this
 * app and deliberate: the catalogue's filter rail reads categories from the
 * shared client cache (with a one-hour `staleTime`), while this screen is a
 * Server Component. Skipping either one leaves half the app showing a tree
 * that no longer exists.
 */
export function useCategoryAdmin() {
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: categoryCache.all });
    startTransition(() => {
      router.refresh();
    });
  };

  const reportError = (error: unknown): void => {
    if (isApiError(error)) {
      // "A category with this slug already exists" is the common one.
      toast.error(error.message);
      return;
    }
    throw error;
  };

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) => {
      const { path, ...options } = id
        ? updateCategoryRequest(id, input)
        : createCategoryRequest(input);
      return api<Category>(path, options);
    },
    onSuccess: async (_data, { id }) => {
      toast.success(id ? "Category updated" : "Category created");
      await refresh();
    },
    onError: reportError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => {
      const { path, ...options } = deleteCategoryRequest(id);
      return api(path, options);
    },
    onSuccess: async () => {
      toast.success("Category removed");
      await refresh();
    },
    onError: reportError,
  });

  return {
    save: (input: CategoryInput, id?: string) =>
      save.mutateAsync({ id, input }).then(
        () => true,
        () => false,
      ),
    remove: (id: string) =>
      remove.mutateAsync(id).then(
        () => true,
        () => false,
      ),
    isPending: save.isPending || remove.isPending || isRefreshing,
  };
}
