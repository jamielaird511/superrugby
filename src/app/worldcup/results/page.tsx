import { redirect } from "next/navigation";
import { getDefaultWorldCupTenant } from "@/lib/worldCupIds";

export const dynamic = "force-static";

export default function LegacyWorldCupResultsRedirect() {
  redirect(`/worldcup/${getDefaultWorldCupTenant().slug}/results`);
}
