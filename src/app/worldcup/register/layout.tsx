import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://paperpunter.co.nz"),
  alternates: { canonical: "https://paperpunter.co.nz/worldcup/register" },
};

export default function WorldCupPublicRegisterLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
