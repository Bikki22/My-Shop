import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

/**
 * Three faces, three jobs — the split the `/design` mockups make everywhere.
 *
 * Fraunces is the voice: headings, the brand mark, panel titles. Inter is
 * the interface. JetBrains Mono carries every figure — prices, totals, order
 * ids, SKUs — because those are meant to be compared down a column, not read
 * as a sentence.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Fraunces is optical-size variable; `globals.css` sets `opsz` per use so
  // display sizes get the high-contrast cut and small titles do not.
  axes: ["opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
