import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participantId, password, resolveEmailFromAuth } = body;

    if (!participantId || !password) {
      return NextResponse.json(
        { error: "participantId and password are required" },
        { status: 400 }
      );
    }

    // Fetch participant with auth_email and auth_user_id
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("id, auth_email, auth_user_id")
      .eq("id", participantId)
      .single();

    if (error || !participant) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if auth_user_id is null (password not set)
    if (!participant.auth_user_id) {
      return NextResponse.json(
        { error: "NO_PASSWORD_SET" },
        { status: 401 }
      );
    }

    let authEmail = participant.auth_email;

    if (resolveEmailFromAuth === true) {
      const { data: authUser, error: authLookupError } =
        await supabaseAdmin.auth.admin.getUserById(participant.auth_user_id);

      if (authLookupError || !authUser?.user?.email) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      authEmail = authUser.user.email;
    }

    return NextResponse.json({
      participantId: participant.id,
      authEmail,
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
