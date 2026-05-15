import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_NAME = 120;
const MAX_EMAIL = 255;
const MAX_IDEA = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const emailInput = typeof body.email === "string" ? body.email.trim() : "";
  const ideaInput =
    body.competitionIdea === undefined || body.competitionIdea === null
      ? ""
      : typeof body.competitionIdea === "string"
        ? body.competitionIdea.trim()
        : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  if (!emailInput) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (emailInput.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Email is too long" }, { status: 400 });
  }
  if (!EMAIL_RE.test(emailInput)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (ideaInput.length > MAX_IDEA) {
    return NextResponse.json({ error: "Competition idea is too long" }, { status: 400 });
  }

  const email = emailInput.toLowerCase();
  const ideaOrNull = ideaInput.length > 0 ? ideaInput : null;

  const { error } = await supabaseAdmin.from("paperpunter_interest").insert({
    name,
    email,
    competition_idea: ideaOrNull,
  });

  if (error) {
    console.error("[POST /api/paperpunter/interest]", error);
    return NextResponse.json({ error: "Could not save your submission" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
