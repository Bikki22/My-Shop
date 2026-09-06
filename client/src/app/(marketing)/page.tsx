import { Button } from "@/components/ui/button";
import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {siteConfig.name}
      </h1>
      <p className="max-w-prose text-muted-foreground">
        {siteConfig.description}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button render={<Link href={routes.products} />}>Browse products</Button>
        <Button render={<Link href={routes.account} />} variant="outline">
          Go to your account
        </Button>
      </div>
    </section>
  );
}
