import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/features/auth/server/guards";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your profile as stored by the marketplace API.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Name">
            {[user.firstName, user.lastName].filter(Boolean).join(" ")}
          </Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Role">
            <Badge variant="secondary">{user.role}</Badge>
          </Row>
          <Row label="Status">
            <Badge variant="outline">{user.status}</Badge>
          </Row>
        </CardContent>
      </Card>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
