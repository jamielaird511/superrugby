import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://paperpunter.co.nz"),
  alternates: { canonical: "https://paperpunter.co.nz/worldcup/login" },
};

export default function WorldCupPublicLoginLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
