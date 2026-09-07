"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api";
import { useApi } from "@/lib/api/client";
import {
  updateUserRoleRequest,
  updateUserStatusRequest,
} from "../api/user-admin.api";
import type { ManagedUser, UserRole, UserStatus } from "../types";

/**
 * Role and status changes on one account.
 *
 * `router.refresh()` rather than a cache write: the customers table is a
 * Server Component, and a role change can cascade — granting `MERCHANT` is
 * what a shop approval does as a side effect, so the two screens have to
 * agree about the result rather than each guessing it.
 *
 * The server refuses to let an admin demote or suspend *themselves*, which is
 * a rule worth leaving there: it is the one that stops the last admin locking
 * everyone out, and a client-side copy would only drift.
 */
export function useUserAdmin() {
  const api = useApi();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const reportError = (error: unknown): void => {
    if (isApiError(error)) {
      toast.error(error.message);
      return;
    }
    throw error;
  };

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => {
      const { path, ...options } = updateUserRoleRequest(id, role);
      return api<ManagedUser>(path, options);
    },
    onSuccess: () => {
      toast.success("Role updated");
      refresh();
    },
    onError: reportError,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => {
      const { path, ...options } = updateUserStatusRequest(id, status);
      return api<ManagedUser>(path, options);
    },
    onSuccess: (_data, { status }) => {
      toast.success(
        status === "SUSPENDED"
          ? "Account suspended — they can no longer sign in"
          : "Account status updated",
      );
      refresh();
    },
    onError: reportError,
  });

  return {
    setRole: (id: string, role: UserRole) => {
      void setRole.mutateAsync({ id, role }).catch(() => null);
    },
    setStatus: (id: string, status: UserStatus) => {
      void setStatus.mutateAsync({ id, status }).catch(() => null);
    },
    isPending: setRole.isPending || setStatus.isPending || isRefreshing,
  };
}
