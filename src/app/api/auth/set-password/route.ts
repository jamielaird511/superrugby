import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    // Check environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { participantId, password } = body;

    if (!participantId || !password) {
      return NextResponse.json(
        { error: "participantId and password are required" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Fetch participant with auth_email and auth_user_id
    const { data: participant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("id, auth_email, auth_user_id")
      .eq("id", participantId)
      .single();

    if (fetchError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    let authEmail = participant.auth_email;
    let authUserId = participant.auth_user_id;

    // If auth_email is null, set it to the internal email format
    if (!authEmail) {
      authEmail = `${participantId}@teams.superrugby.local`;
      
      // Update participants.auth_email
      const { error: updateEmailError } = await supabaseAdmin
        .from("participants")
        .update({ auth_email: authEmail })
        .eq("id", participantId);

      if (updateEmailError) {
        console.error("Error updating auth_email:", updateEmailError);
        return NextResponse.json(
          { error: "Failed to set auth email" },
          { status: 500 }
        );
      }
    }

    // If auth_user_id is null, create a Supabase Auth user
    if (!authUserId) {
      const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });

      if (createUserError) {
        console.error("Error creating auth user:", createUserError);
        return NextResponse.json(
          { error: "Failed to create auth user" },
          { status: 500 }
        );
      }

      authUserId = authData.user.id;

      // Update participants.auth_user_id (and ensure auth_email is saved)
      const { error: updateUserError } = await supabaseAdmin
        .from("participants")
        .update({ auth_user_id: authUserId, auth_email: authEmail })
        .eq("id", participantId);

      if (updateUserError) {
        console.error("Error updating auth_user_id:", updateUserError);
        return NextResponse.json(
          { error: "Failed to update auth user id" },
          { status: 500 }
        );
      }
    }

    // Return success with participantId and authEmail
    return NextResponse.json({ participantId: participant.id, authEmail }, { status: 200 });
  } catch (err) {
    console.error("Set password error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
