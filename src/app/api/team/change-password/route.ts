import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, comparePassword } from "@/lib/password";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createServerClient(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  } else {
    const cookies = req.headers.get("cookie") || "";
    const cookieMatch = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
    if (cookieMatch) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(cookieMatch[1]));
        accessToken = sessionData?.access_token || null;
      } catch {
        accessToken = decodeURIComponent(cookieMatch[1]);
      }
    }
  }

  return createClient(supabaseUrl || "", supabaseAnonKey || "", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        cookie: req.headers.get("cookie") || "",
      },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { teamId, currentPassword, newPassword } = body;

    if (!teamId || !newPassword) {
      return NextResponse.json(
        { error: "teamId and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, auth_user_id, password_hash")
      .eq("id", teamId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    if (participant.auth_user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: you can only change password for your own team" },
        { status: 403 }
      );
    }

    const isSetFlow = !participant.password_hash;

    if (!isSetFlow) {
      if (currentPassword == null || currentPassword === "") {
        return NextResponse.json(
          { error: "Current password is required to change an existing password" },
          { status: 400 }
        );
      }
      const valid = await comparePassword(currentPassword, participant.password_hash);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 401 }
        );
      }
    }

    const passwordHash = await hashPassword(newPassword);

    const { error: updateDbError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: passwordHash })
      .eq("id", teamId);

    if (updateDbError) {
      console.error("Error updating participant password_hash:", updateDbError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (authError) {
      console.error("Error updating Auth password:", authError);
      return NextResponse.json(
        { error: authError.message || "Failed to update auth password" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mode: isSetFlow ? "set" : "change" });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
