import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://paperpunter.com"),
  title: {
    default: "PaperPunter — private tipping competitions",
    template: "%s · PaperPunter",
  },
  description:
    "PaperPunter helps you run private tipping competitions and FIFA World Cup pools—picks, results, and leaderboards without spreadsheet chaos.",
  applicationName: "PaperPunter",
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const paperPunterFullBleed =
    hdrs.get("x-paperpunter-full-bleed") === "1";

  return (
    <html lang="en" className={paperPunterFullBleed ? "!bg-transparent" : undefined}>
      <body
        className={`${inter.className} ${geistMono.variable} antialiased min-h-screen flex flex-col ${
          paperPunterFullBleed ? "!bg-transparent" : "dark:bg-black"
        }`}
      >
        <main
          className={
            paperPunterFullBleed
              ? "flex-1 min-h-0 w-full min-w-0 overflow-x-hidden bg-transparent"
              : "flex-1 bg-[#EEF6FB]"
          }
        >
          {paperPunterFullBleed ? (
            <div className="min-h-0 w-full min-w-0 overflow-x-hidden">
              {children}
            </div>
          ) : (
            <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 xl:px-16">
              {children}
            </div>
          )}
        </main>
        {paperPunterFullBleed ? null : <SiteFooter />}
      </body>
    </html>
  );
}
