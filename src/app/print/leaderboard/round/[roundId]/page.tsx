import PrintRoundLeaderboardClient from "./PrintRoundLeaderboardClient";

type Params = { roundId?: string };

export default async function PrintRoundLeaderboard({
  params,
}: {
  params?: Promise<Params> | Params;
}) {
  const p = params ? await Promise.resolve(params) : undefined;
  const roundId = p?.roundId ?? "";

  return <PrintRoundLeaderboardClient roundId={roundId} />;
}
