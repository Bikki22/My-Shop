import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

/** Rendered whenever a guard calls `forbidden()` — the 403 boundary. */
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        You don&apos;t have access to this page
      </h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Your account is signed in, but its role doesn&apos;t permit this area.
      </p>
      <Button render={<Link href={routes.home} />} variant="outline">
        Back to home
      </Button>
    </main>
  );
}
