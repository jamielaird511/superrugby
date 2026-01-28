import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/password";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

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
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { ...(accessToken && { Authorization: `Bearer ${accessToken}` }), cookie: req.headers.get("cookie") || "" },
    },
  });
}

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = 10 + Math.floor(Math.random() * 3);
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const adminKeyHeader = request.headers.get("x-admin-key");
    const adminKey = process.env.ADMIN_KEY;

    if (authHeader?.startsWith("Bearer ") && supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(request);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email || !adminEmails.includes(user.email)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (adminKey && adminKeyHeader === adminKey) {
      // x-admin-key accepted
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required" },
        { status: 400 }
      );
    }

    const { data: participant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("id, auth_user_id, auth_email")
      .eq("id", participantId)
      .single();

    if (fetchError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    if (!participant.auth_user_id && !participant.auth_email) {
      return NextResponse.json(
        { error: "Participant has no auth user; cannot reset password" },
        { status: 400 }
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: passwordHash })
      .eq("id", participantId);

    if (updateError) {
      console.error("Error updating password_hash:", updateError);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500 }
      );
    }

    let authUserId: string | null = participant.auth_user_id;

    if (!authUserId && participant.auth_email) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const match = data?.users?.find((u) => u.email === participant.auth_email);
      authUserId = match?.id ?? null;
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: "Auth user not found for this participant" },
        { status: 400 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: tempPassword,
    });

    if (authError) {
      console.error("Error updating Auth password:", authError);
      return NextResponse.json(
        { error: authError.message || "Failed to update auth password" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tempPassword });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
