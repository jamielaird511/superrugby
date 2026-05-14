import { redirect } from "next/navigation";
import { getDefaultWorldCupTenant } from "@/lib/worldCupIds";

export const dynamic = "force-dynamic";

export default async function LegacyWorldCupCompetitionPicksRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/worldcup/${getDefaultWorldCupTenant().slug}/team/${id}/competition-picks`);
}
