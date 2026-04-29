import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/password";

const FIFA_WORLD_CUP_2026_LEAGUE_ID = "a908c579-842c-43c8-85d3-229b543bb2a3";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!firstName) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const fullName = `${firstName} ${lastName}`;
    const passwordHash = await hashPassword(password);

    // Avoid duplicate World Cup registrations by email where possible.
    const { data: existingContacts, error: existingContactsError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id")
      .ilike("email", email)
      .limit(1);

    if (existingContactsError) {
      console.error("Error checking existing contact:", existingContactsError);
      return NextResponse.json({ error: "Failed to validate registration" }, { status: 500 });
    }

    const existingParticipantId = existingContacts?.[0]?.participant_id as string | undefined;
    if (existingParticipantId) {
      const { data: existingParticipant, error: existingParticipantError } = await supabaseAdmin
        .from("participants")
        .select("id, name, league_id")
        .eq("id", existingParticipantId)
        .maybeSingle();

      if (existingParticipantError) {
        console.error("Error checking existing participant:", existingParticipantError);
        return NextResponse.json({ error: "Failed to validate registration" }, { status: 500 });
      }

      if (existingParticipant?.league_id === FIFA_WORLD_CUP_2026_LEAGUE_ID) {
        const { error: updateExistingPasswordError } = await supabaseAdmin
          .from("participants")
          .update({ password_hash: passwordHash })
          .eq("id", existingParticipant.id);

        if (updateExistingPasswordError) {
          console.error("Error updating existing world cup password:", updateExistingPasswordError);
          return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
        }

        return NextResponse.json(
          {
            participantId: existingParticipant.id,
            name: existingParticipant.name || fullName,
            email,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "This email is already registered in another competition" },
        { status: 409 }
      );
    }

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .insert({
        name: fullName,
        team_name: fullName,
        league_id: FIFA_WORLD_CUP_2026_LEAGUE_ID,
        password_hash: passwordHash,
      })
      .select("id, name")
      .single();

    if (participantError || !participant) {
      console.error("Error creating world cup participant:", participantError);
      return NextResponse.json({ error: "Failed to register participant" }, { status: 500 });
    }

    const { error: contactError } = await supabaseAdmin.from("participant_contacts").insert({
      participant_id: participant.id,
      email,
      is_primary: true,
      receives_updates: true,
    });

    if (contactError) {
      console.error("Error creating participant contact:", contactError);
      return NextResponse.json({ error: "Failed to save contact email" }, { status: 500 });
    }

    return NextResponse.json(
      {
        participantId: participant.id,
        name: participant.name || fullName,
        email,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup registration error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
