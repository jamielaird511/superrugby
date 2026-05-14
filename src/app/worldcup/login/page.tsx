import { redirect } from "next/navigation";
import { getDefaultWorldCupTenant } from "@/lib/worldCupIds";

export const dynamic = "force-static";

export default function LegacyWorldCupLoginRedirect() {
  redirect(`/worldcup/${getDefaultWorldCupTenant().slug}/login`);
}
