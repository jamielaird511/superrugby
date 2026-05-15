import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";
import { hashPassword } from "@/lib/password";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Readable temp password: 10–12 chars, avoids ambiguous 0/O/1/l. */
function generateTemporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const len = 10 + Math.floor(Math.random() * 3);
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  const userEmailLower = user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmailLower)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const tenantSlug =
    typeof body === "object" && body !== null && "tenant" in body
      ? String((body as { tenant?: unknown }).tenant ?? "").trim().toLowerCase()
      : "";
  const participantId =
    typeof body === "object" && body !== null && "participantId" in body
      ? String((body as { participantId?: unknown }).participantId ?? "").trim()
      : "";

  const tenant = resolveWorldCupTenant(tenantSlug);
  if (!tenant || !participantId || !UUID_RE.test(participantId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { data: participant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("id, league_id")
      .eq("id", participantId)
      .maybeSingle();

    if (fetchError) {
      console.error("[WC admin reset-password] participant lookup", fetchError);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    if (!participant || participant.league_id !== tenant.leagueId) {
      return NextResponse.json({ error: "Unable to complete request" }, { status: 400 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: passwordHash })
      .eq("id", participantId)
      .eq("league_id", tenant.leagueId)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      if (updateError) {
        console.error("[WC admin reset-password] update", updateError);
      }
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    return NextResponse.json({ temporaryPassword }, { status: 200 });
  } catch (e) {
    console.error("[WC admin reset-password] unexpected", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
