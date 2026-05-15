import type { Metadata } from "next";
import SuperRugbyLoginHomeClient from "./SuperRugbyLoginHomeClient";

/** Tab title on non–PaperPunter hosts where `/` is the Super Rugby sign-in. */
export const metadata: Metadata = {
  title: { absolute: "Super Rugby competition — sign in" },
  description: "Sign in to your private Super Rugby tipping competition.",
};

/** Root `/` — Super Rugby login. PaperPunter domains rewrite `/` → `/paperpunter` in middleware. */
export default function Home() {
  return <SuperRugbyLoginHomeClient />;
}
