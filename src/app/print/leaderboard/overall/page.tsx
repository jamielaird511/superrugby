import PrintOverallLeaderboardClient from "./PrintOverallLeaderboardClient";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function PrintOverallLeaderboard({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const sp = searchParams ? await Promise.resolve(searchParams) : undefined;
  const leagueIdParamRaw = sp?.leagueId;
  const leagueIdParam =
    typeof leagueIdParamRaw === "string"
      ? leagueIdParamRaw
      : Array.isArray(leagueIdParamRaw)
        ? leagueIdParamRaw[0]
        : undefined;

  return <PrintOverallLeaderboardClient leagueIdParam={leagueIdParam} />;
}
