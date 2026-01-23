import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

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

    // Fetch participant to verify it exists
    const { data: participant, error: fetchError } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .single();

    if (fetchError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update participant password_hash
    const { error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: passwordHash })
      .eq("id", participantId);

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: "Failed to set password" },
        { status: 500 }
      );
    }

    // Return success with participantId
    return NextResponse.json({ participantId: participant.id }, { status: 200 });
  } catch (err) {
    console.error("Set password error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
