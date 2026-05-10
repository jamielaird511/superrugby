import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SuperRugbyLoginHomeClient from "./SuperRugbyLoginHomeClient";

const PAPER_PUNTER_ROOT_HOSTS = new Set([
  "localhost",
  "paperpunter.com",
  "www.paperpunter.com",
]);

function hostnameFromHeaders(h: Headers): string {
  const raw =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host")?.trim() ||
    "";
  return raw.split(":")[0]?.toLowerCase() ?? "";
}

export default async function Home() {
  const host = hostnameFromHeaders(await headers());
  if (PAPER_PUNTER_ROOT_HOSTS.has(host)) {
    redirect("/paperpunter");
  }

  return <SuperRugbyLoginHomeClient />;
}
