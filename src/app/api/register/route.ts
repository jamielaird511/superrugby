import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, teamName, category, emails, password, leagueCode } = body;

    // Validate required fields
    if (!businessName || !teamName || !category || !password || !leagueCode) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Look up league by league_code
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("league_code", leagueCode)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { error: "Invalid league code" },
        { status: 401 }
      );
    }

    const leagueId = league.id;

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate emails
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "At least one contact email is required" },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails
      .map((email: string) => email.trim())
      .filter((email: string) => email !== "");
    
    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: "At least one valid email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    for (const email of validEmails) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid email format: ${email}` },
          { status: 400 }
        );
      }
    }

    // Insert participant using supabaseAdmin (service role)
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .insert([
        {
          name: `${businessName.trim()} — ${teamName.trim()}`,
          business_name: businessName.trim(),
          team_name: teamName.trim(),
          category: category,
          league_id: leagueId,
        },
      ])
      .select("id")
      .single();

    if (participantError || !participant) {
      console.error("Error creating participant:", participantError);
      return NextResponse.json(
        { error: "Failed to create participant" },
        { status: 500 }
      );
    }

    const participantId = participant.id;
    const authEmail = `${participantId}@teams.superrugby.local`;

    // Ensure auth_email is set
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

    // Create Supabase Auth user
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

    // Update participants.auth_user_id
    const { error: updateUserError } = await supabaseAdmin
      .from("participants")
      .update({ auth_user_id: authData.user.id })
      .eq("id", participantId);

    if (updateUserError) {
      console.error("Error updating auth_user_id:", updateUserError);
      return NextResponse.json(
        { error: "Failed to update auth user id" },
        { status: 500 }
      );
    }

    // Check if primary contact already exists (prevent duplicates on retry)
    const { data: existingPrimary, error: checkError } = await supabaseAdmin
      .from("participant_contacts")
      .select("id")
      .eq("participant_id", participantId)
      .eq("is_primary", true)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing primary contact:", checkError);
      return NextResponse.json(
        { error: "Failed to check existing contacts" },
        { status: 500 }
      );
    }

    // Dedupe emails
    const uniqueEmails = Array.from(new Set(validEmails));
    const primaryEmail = uniqueEmails[0];
    const additionalEmails = uniqueEmails.slice(1);

    // Insert primary contact if it doesn't exist
    if (!existingPrimary) {
      const { error: primaryContactError } = await supabaseAdmin
        .from("participant_contacts")
        .insert([
          {
            participant_id: participantId,
            email: primaryEmail,
            is_primary: true,
            receives_updates: true,
          },
        ]);

      if (primaryContactError) {
        console.error("Error creating primary contact:", primaryContactError);
        return NextResponse.json(
          { error: "Failed to create primary contact" },
          { status: 500 }
        );
      }
    }

    // Insert additional contacts (if any)
    if (additionalEmails.length > 0) {
      const additionalContactsToInsert = additionalEmails.map((email: string) => ({
        participant_id: participantId,
        email: email,
        is_primary: false,
        receives_updates: true,
      }));

      const { error: additionalContactsError } = await supabaseAdmin
        .from("participant_contacts")
        .insert(additionalContactsToInsert);

      if (additionalContactsError) {
        console.error("Error creating additional contacts:", additionalContactsError);
        return NextResponse.json(
          { error: "Failed to create additional contacts" },
          { status: 500 }
        );
      }
    }

    // Return success with participantId and authEmail
    return NextResponse.json(
      { participantId: participantId, authEmail },
      { status: 200 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
