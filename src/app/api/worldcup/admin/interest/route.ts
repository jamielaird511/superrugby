import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUSES = ["new", "contacted", "archived"] as const;
type Status = (typeof STATUSES)[number];

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

export async function GET(_req: NextRequest) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await supabaseAdmin
      .from("paperpunter_interest")
      .select("id, name, email, competition_idea, created_at, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[WC admin interest GET]", error);
      return NextResponse.json({ error: "Failed to load submissions" }, { status: 500 });
    }

    return NextResponse.json({ submissions: data || [] }, { status: 200 });
  } catch (e) {
    console.error("[WC admin interest GET] exception", e);
    return NextResponse.json({ error: "Failed to load submissions" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!STATUSES.includes(statusRaw as Status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("paperpunter_interest")
      .update({ status: statusRaw })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("[WC admin interest PATCH]", error);
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ submission: data }, { status: 200 });
  } catch (e) {
    console.error("[WC admin interest PATCH] exception", e);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
