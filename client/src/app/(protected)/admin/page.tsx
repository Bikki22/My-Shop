import type { Metadata } from "next";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/features/auth/server/guards";

export const metadata: Metadata = { title: "Admin" };

/**
 * `requireAdmin()` renders the 403 page for signed-in users without an
 * admin role, so nothing below it needs its own check.
 */
export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Signed in as {user.email} ({user.role}).
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
