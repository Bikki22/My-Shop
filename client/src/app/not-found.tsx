import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <Button render={<Link href={routes.home} />} variant="outline">
        Back to home
      </Button>
    </main>
  );
}
