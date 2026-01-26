"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TeamNav from "@/components/TeamNav";

type Participant = {
  id: string;
  team_name: string;
  business_name: string | null;
  category: string | null;
};

type Contact = {
  id: string;
  email: string;
  receives_updates?: boolean;
};

type SettingsData = {
  participant: Participant;
  contacts: {
    primary: { id: string; email: string } | null;
    additional: Contact[];
  };
};

export default function SettingsPage() {
  const params = useParams();
  const participantId = params.id as string;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [teamName, setTeamName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    if (participantId) {
      fetchInitialData();
    }
  }, [participantId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch participant
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id, team_name, business_name, category")
        .eq("id", participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant({
        id: participantData.id,
        team_name: participantData.team_name,
        business_name: participantData.business_name,
        category: participantData.category,
      });

      // Fetch settings data
      await fetchSettings();
    } catch (err) {
      console.error("Error fetching initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      const data: SettingsData = await response.json();
      setSettingsData(data);
      setTeamName(data.participant.team_name);
      setBusinessName(data.participant.business_name || "");
      setPrimaryEmail(data.contacts.primary?.email || "");
    } catch (err) {
      console.error("Error fetching settings:", err);
      setMessage({ type: "error", text: "Failed to load settings" });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("participant_id");
    window.location.href = "/";
  };

  const saveTeamDetails = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: teamName.trim(),
          business_name: businessName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Team details saved successfully" });
      await fetchSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save team details";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const savePrimaryEmail = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_email: primaryEmail.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Primary email updated successfully" });
      await fetchSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save primary email";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          add_email: newEmail.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add email");
      }

      setMessage({ type: "success", text: "Email added successfully" });
      setNewEmail("");
      await fetchSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add email";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const toggleReceivesUpdates = async (contactId: string, currentValue: boolean) => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_contact: {
            contact_id: contactId,
            receives_updates: !currentValue,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update");
      }

      await fetchSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to remove this email recipient?")) return;

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delete_contact_id: contactId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }

      setMessage({ type: "success", text: "Email removed successfully" });
      await fetchSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans pt-16">
        <div className="text-center">
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans pt-16">
      <TeamNav teamId={participantId} teamName={participant?.team_name || "Team"} onLogout={handleLogout} />

      <div className="py-8 pt-8">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-3xl font-semibold text-[#003A5D] mb-6">Settings</h1>

          {message && (
            <div
              className={`mb-4 rounded-md p-3 ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Team Details Section */}
          <section className="mb-8">
            <div className="rounded-lg border border-zinc-300 bg-white p-6">
              <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Team Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1"
                  />
                </div>
                <button
                  onClick={saveTeamDetails}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-md bg-[#003A5D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004165] focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </section>

          {/* Emails Section */}
          <section className="mb-8">
            <div className="rounded-lg border border-zinc-300 bg-white p-6">
              <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Emails</h2>
              <div className="space-y-6">
                {/* Primary Email */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Primary Email
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="email"
                      value={primaryEmail}
                      onChange={(e) => setPrimaryEmail(e.target.value)}
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1"
                    />
                    <button
                      onClick={savePrimaryEmail}
                      disabled={saving}
                      className="inline-flex items-center justify-center rounded-md bg-[#003A5D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004165] focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {/* Additional Recipients */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    Additional Recipients
                  </label>
                  {settingsData?.contacts.additional && settingsData.contacts.additional.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {settingsData.contacts.additional.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                        >
                          <span className="flex-1 text-sm text-zinc-900">{contact.email}</span>
                          <label className="flex items-center gap-2 text-xs text-zinc-600">
                            <input
                              type="checkbox"
                              checked={contact.receives_updates ?? true}
                              onChange={() =>
                                toggleReceivesUpdates(contact.id, contact.receives_updates ?? true)
                              }
                              disabled={saving}
                              className="rounded border-zinc-300 text-[#003A5D] focus:ring-[#004165]"
                            />
                            Receives updates
                          </label>
                          <button
                            onClick={() => deleteContact(contact.id)}
                            disabled={saving}
                            className="text-xs text-red-600 hover:text-red-700 focus:outline-none disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 mb-4">No additional recipients</p>
                  )}

                  {/* Add Email */}
                  <div className="flex items-center gap-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addEmail();
                        }
                      }}
                    />
                    <button
                      onClick={addEmail}
                      disabled={saving || !newEmail.trim()}
                      className="inline-flex items-center justify-center rounded-md bg-[#003A5D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004165] focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rules Section */}
          <section className="mb-8">
            <div className="rounded-lg border border-zinc-300 bg-white p-6">
              <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Rules</h2>
              <div className="space-y-2 text-sm text-zinc-700">
                <p>Scoring: 5 points for correct winner + 3 points for correct margin band.</p>
                <p>Picks lock at kickoff.</p>
                <p>You can update picks until kickoff.</p>
                <p>Leaderboard updates once results are entered.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
