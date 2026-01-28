import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/password";

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
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const adminKeyHeader = request.headers.get("x-admin-key");
    if (!adminKeyHeader || adminKeyHeader !== adminKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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
