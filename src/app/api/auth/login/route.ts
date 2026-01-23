import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participantId, password } = body;

    if (!participantId || !password) {
      return NextResponse.json(
        { error: "participantId and password are required" },
        { status: 400 }
      );
    }

    // Fetch participant with password_hash
    const { data: participant, error } = await supabase
      .from("participants")
      .select("id, password_hash")
      .eq("id", participantId)
      .single();

    if (error || !participant) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check if password_hash is null
    if (!participant.password_hash) {
      return NextResponse.json(
        { error: "This team needs to register again." },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, participant.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Return success with participantId
    return NextResponse.json({ participantId: participant.id });
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
