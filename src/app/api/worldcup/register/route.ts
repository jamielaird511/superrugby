import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/password";
import { readWorldCupAccessCode } from "@/lib/worldCupIds";
import { resolveTenantFromBodyOrUrl } from "@/lib/worldCupRequestTenant";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const accessCode = String(body?.accessCode ?? "");

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

    const tenantRes = resolveTenantFromBodyOrUrl(body, req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const configuredAccessCode = readWorldCupAccessCode(tenant);
    if (!configuredAccessCode) {
      console.error(
        `[worldcup/register] access code env (${tenant.accessCodeEnvName}) missing; denying registration`
      );
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }
    if (accessCode.trim().toLowerCase() !== configuredAccessCode.toLowerCase()) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 403 });
    }

    const fullName = `${firstName} ${lastName}`;
    const passwordHash = await hashPassword(password);

    // Per-tenant duplicate-email check: only block if the same email is already
    // registered to a participant in the **same tenant's league**. The same email
    // can join different World Cup tenants.
    const { data: existingContacts, error: existingContactsError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id")
      .ilike("email", email);

    if (existingContactsError) {
      console.error("Error checking existing contact:", existingContactsError);
      return NextResponse.json({ error: "Failed to validate registration" }, { status: 500 });
    }

    const existingParticipantIds = (existingContacts || [])
      .map((c) => c.participant_id as string | undefined)
      .filter((id): id is string => !!id);

    if (existingParticipantIds.length > 0) {
      const { data: existingParticipants, error: existingParticipantError } = await supabaseAdmin
        .from("participants")
        .select("id, name, league_id")
        .in("id", existingParticipantIds);

      if (existingParticipantError) {
        console.error("Error checking existing participant:", existingParticipantError);
        return NextResponse.json({ error: "Failed to validate registration" }, { status: 500 });
      }

      const existingInTenant = (existingParticipants || []).find(
        (p) => p.league_id === tenant.leagueId
      );

      if (existingInTenant) {
        const { error: updateExistingPasswordError } = await supabaseAdmin
          .from("participants")
          .update({ password_hash: passwordHash })
          .eq("id", existingInTenant.id);

        if (updateExistingPasswordError) {
          console.error(
            "Error updating existing world cup password:",
            updateExistingPasswordError
          );
          return NextResponse.json({ error: "Failed to update registration" }, { status: 500 });
        }

        return NextResponse.json(
          {
            participantId: existingInTenant.id,
            name: existingInTenant.name || fullName,
            email,
            tenant: tenant.slug,
          },
          { status: 200 }
        );
      }
      // Email exists in a different World Cup tenant or in Super Rugby — allow a new
      // participant row in this tenant and link a fresh contact row.
    }

    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .insert({
        name: fullName,
        team_name: fullName,
        league_id: tenant.leagueId,
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
        tenant: tenant.slug,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup registration error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
