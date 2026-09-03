"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useApi } from "@/lib/api/client";
import { isApiError } from "@/lib/api";
import { updateMeRequest } from "../api/user.api";
import type { CurrentUser, UpdateProfileInput } from "../types";

/**
 * Updates the signed-in user's profile against `PATCH /user/me`.
 *
 * Field-level errors from the server's Zod validation are surfaced as a
 * `field -> message` map so a form can render them next to their input.
 */
export function useProfile() {
  const api = useApi();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (input: UpdateProfileInput): Promise<CurrentUser | null> => {
      setFieldErrors({});
      setError(null);
      setIsSaving(true);

      const { path, method, body } = updateMeRequest(input);
      try {
        const user = await api<CurrentUser>(path, { method, body });

        // Server Components hold the old record, so re-render them — that's
        // what updates the name and avatar in the header.
        startTransition(() => {
          router.refresh();
        });
        return user;
      } catch (caught) {
        if (isApiError(caught)) {
          setError(caught.message);
          setFieldErrors(
            Object.fromEntries(
              caught.details.map(({ field, message }) => [field, message]),
            ),
          );
          return null;
        }
        throw caught;
      } finally {
        setIsSaving(false);
      }
    },
    [api, router],
  );

  return { update, isPending: isSaving || isRefreshing, error, fieldErrors };
}
