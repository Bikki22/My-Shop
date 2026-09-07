"use client";

import { NativeSelect } from "@/components/ui/native-select";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";
import { useUserAdmin } from "../hooks/use-user-admin";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  USER_STATUS_LABELS,
  type ManagedUser,
  type UserRole,
  type UserStatus,
} from "../types";

/**
 * The role and status controls on one row of the customers table.
 *
 * Selects rather than a menu of buttons: both are a short list of mutually
 * exclusive values, which is exactly what a select is for, and it makes the
 * current value visible without opening anything.
 *
 * A staff member's controls over their **own** account are disabled. The
 * server refuses that write anyway — it is what stops the last admin locking
 * everyone out — so this only turns a 403 into an obvious "not that one".
 *
 * `DELETED` is absent from the status options: it is a state an account
 * arrives at by the person deleting their own account, not one staff push it
 * into, and offering it here would suggest otherwise.
 */
const SETTABLE_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
] as const satisfies readonly UserStatus[];

export function UserRowControls({ user }: { user: ManagedUser }) {
  const me = useCurrentUser();
  const { setRole, setStatus, isPending } = useUserAdmin();

  const isSelf = me?._id === user._id;
  const disabled = isPending || isSelf || user.status === "DELETED";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <NativeSelect
        aria-label={`Role for ${user.email}`}
        value={user.role}
        disabled={disabled}
        className="w-36"
        onChange={(event) => {
          setRole(user._id, event.target.value as UserRole);
        }}
      >
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {USER_ROLE_LABELS[role]}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        aria-label={`Status for ${user.email}`}
        value={user.status === "DELETED" ? "ACTIVE" : user.status}
        disabled={disabled}
        className="w-32"
        onChange={(event) => {
          setStatus(user._id, event.target.value as UserStatus);
        }}
      >
        {SETTABLE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {USER_STATUS_LABELS[status]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
