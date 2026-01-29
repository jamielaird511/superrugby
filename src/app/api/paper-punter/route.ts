import { NextRequest, NextResponse } from "next/server";
import { calculatePaperPunter } from "@/lib/paperPunter";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");

    if (!roundId) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 }
      );
    }

    const results = await calculatePaperPunter(roundId);

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (err) {
    console.error("Paper punter error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
