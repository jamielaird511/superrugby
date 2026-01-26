import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const client = createClient(
    supabaseUrl || "",
    supabaseAnonKey || "",
    {
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
    }
  );

  return client;
}

export async function GET(req: NextRequest) {
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

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, team_name, business_name, category")
      .eq("auth_user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "NO_PARTICIPANT" },
        { status: 403 }
      );
    }

    // Fetch contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("participant_contacts")
      .select("id, email, is_primary, receives_updates")
      .eq("participant_id", participant.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: 500 }
      );
    }

    const primaryContact = contacts?.find((c) => c.is_primary) || null;
    const additionalContacts = contacts?.filter((c) => !c.is_primary) || [];

    return NextResponse.json({
      participant: {
        id: participant.id,
        team_name: participant.team_name,
        business_name: participant.business_name,
        category: participant.category,
      },
      contacts: {
        primary: primaryContact ? { id: primaryContact.id, email: primaryContact.email } : null,
        additional: additionalContacts.map((c) => ({
          id: c.id,
          email: c.email,
          receives_updates: c.receives_updates,
        })),
      },
    });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
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

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "NO_PARTICIPANT" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { team_name, business_name, primary_email, add_email, update_contact, delete_contact_id } = body;

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Update participant fields
    if (team_name !== undefined || business_name !== undefined) {
      const updateData: { team_name?: string; business_name?: string } = {};
      if (team_name !== undefined) updateData.team_name = team_name.trim();
      if (business_name !== undefined) updateData.business_name = business_name.trim();

      const { error: updateError } = await supabase
        .from("participants")
        .update(updateData)
        .eq("id", participant.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update participant" },
          { status: 500 }
        );
      }
    }

    // Update primary email
    if (primary_email !== undefined) {
      if (!emailRegex.test(primary_email.trim())) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      // Get current primary contact
      const { data: currentPrimary, error: primaryFetchError } = await supabase
        .from("participant_contacts")
        .select("id")
        .eq("participant_id", participant.id)
        .eq("is_primary", true)
        .single();

      if (primaryFetchError && primaryFetchError.code !== "PGRST116") {
        return NextResponse.json(
          { error: "Failed to fetch primary contact" },
          { status: 500 }
        );
      }

      const emailLower = primary_email.trim().toLowerCase();

      // Check for duplicate (case-insensitive)
      const { data: existing, error: checkError } = await supabase
        .from("participant_contacts")
        .select("id, is_primary")
        .eq("participant_id", participant.id)
        .ilike("email", emailLower)
        .maybeSingle();

      if (checkError) {
        return NextResponse.json(
          { error: "Failed to check email" },
          { status: 500 }
        );
      }

      if (existing && existing.id !== currentPrimary?.id) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 }
        );
      }

      if (currentPrimary) {
        // Update existing primary
        const { error: updateError } = await supabase
          .from("participant_contacts")
          .update({ email: primary_email.trim() })
          .eq("id", currentPrimary.id);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to update primary email" },
            { status: 500 }
          );
        }
      } else {
        // Create new primary if none exists
        const { error: insertError } = await supabase
          .from("participant_contacts")
          .insert({
            participant_id: participant.id,
            email: primary_email.trim(),
            is_primary: true,
            receives_updates: true,
          });

        if (insertError) {
          return NextResponse.json(
            { error: "Failed to create primary email" },
            { status: 500 }
          );
        }
      }
    }

    // Add additional email
    if (add_email !== undefined) {
      const emailTrimmed = add_email.trim();
      if (!emailRegex.test(emailTrimmed)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      const emailLower = emailTrimmed.toLowerCase();

      // Check for duplicate (case-insensitive)
      const { data: existing, error: checkError } = await supabase
        .from("participant_contacts")
        .select("id")
        .eq("participant_id", participant.id)
        .ilike("email", emailLower)
        .maybeSingle();

      if (checkError) {
        return NextResponse.json(
          { error: "Failed to check email" },
          { status: 500 }
        );
      }

      if (existing) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabase
        .from("participant_contacts")
        .insert({
          participant_id: participant.id,
          email: emailTrimmed,
          is_primary: false,
          receives_updates: true,
        });

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to add email" },
          { status: 500 }
        );
      }
    }

    // Update contact receives_updates
    if (update_contact !== undefined) {
      const { contact_id, receives_updates } = update_contact;

      // Verify contact belongs to participant and is not primary
      const { data: contact, error: contactError } = await supabase
        .from("participant_contacts")
        .select("id, is_primary")
        .eq("id", contact_id)
        .eq("participant_id", participant.id)
        .single();

      if (contactError || !contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      if (contact.is_primary) {
        return NextResponse.json(
          { error: "Cannot modify primary contact" },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabase
        .from("participant_contacts")
        .update({ receives_updates: receives_updates })
        .eq("id", contact_id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update contact" },
          { status: 500 }
        );
      }
    }

    // Delete additional contact
    if (delete_contact_id !== undefined) {
      // Verify contact belongs to participant and is not primary
      const { data: contact, error: contactError } = await supabase
        .from("participant_contacts")
        .select("id, is_primary")
        .eq("id", delete_contact_id)
        .eq("participant_id", participant.id)
        .single();

      if (contactError || !contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      if (contact.is_primary) {
        return NextResponse.json(
          { error: "Cannot delete primary contact" },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from("participant_contacts")
        .delete()
        .eq("id", delete_contact_id);

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to delete contact" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
