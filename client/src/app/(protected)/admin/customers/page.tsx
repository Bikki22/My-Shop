import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { UserRowControls } from "@/features/users/components/user-row-controls";
import { listUsers } from "@/features/users/server/users";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  USER_STATUS_LABELS,
} from "@/features/users/types";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Customers",
  description: "Every account on the marketplace.",
};

const PAGE_SIZE = 20;

/**
 * Accounts, and what each is allowed to do.
 *
 * Every account rather than only buyers, despite the name the design gives
 * this screen: merchants and staff are accounts too, and this is the only
 * place a role can be granted. Filtering by role is how the buyer-only view
 * is reached.
 */
export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  const params = await searchParams;

  const rawRole = params["role"];
  const roleParam = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  const role = USER_ROLES.find((value) => value === roleParam) ?? null;

  const rawSearch = params["q"];
  const search = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch) ?? "";
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { page: result, error } = await listUsers({
    role,
    status: null,
    search,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Customers
        </h1>
        <p className="text-sm text-muted-foreground">
          {error
            ? "Accounts are unavailable right now."
            : `${pluralize(result.pagination.total, "account")}${role ? ` with the ${USER_ROLE_LABELS[role].toLowerCase()} role` : ""}.`}
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Filter accounts" className="flex flex-wrap gap-2">
          {[null, ...USER_ROLES].map((value) => {
            const current = value === role;
            return (
              <Link
                key={value ?? "all"}
                href={
                  value
                    ? `${routes.admin.customers}?role=${value}`
                    : routes.admin.customers
                }
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none",
                  "focus-visible:ring-3 focus-visible:ring-ring/50",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {value ? USER_ROLE_LABELS[value] : "Everyone"}
              </Link>
            );
          })}
        </nav>

        <form action={routes.admin.customers} className="flex max-w-xs gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search by name or email"
            aria-label="Search accounts"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load accounts</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No accounts match this view.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Role and access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((user) => (
                <TableRow key={user._id}>
                  <TableCell>
                    <span className="font-medium">
                      {[user.firstName, user.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLogin ? formatDate(user.lastLogin) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.status === "ACTIVE" ? "secondary" : "destructive"
                      }
                    >
                      {USER_STATUS_LABELS[user.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserRowControls user={user} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
