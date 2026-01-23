"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Participant = {
  id: string;
  team_name: string;
};

export default function Home() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, team_name")
        .order("team_name", { ascending: true });

      if (error) {
        console.error("Error fetching participants:", error);
        setMessage(`Error loading teams: ${error.message}`);
      } else {
        setParticipants(data || []);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!selectedParticipantId) {
        setMessage("Please select a team");
        setLoading(false);
        return;
      }

      if (!password) {
        setMessage("Please enter a password");
        setLoading(false);
        return;
      }

      // First, check if participant has a password_hash
      const { data: participant, error: fetchError } = await supabase
        .from("participants")
        .select("id, password_hash")
        .eq("id", selectedParticipantId)
        .single();

      if (fetchError || !participant) {
        setMessage("Team not found");
        setLoading(false);
        return;
      }

      // If password_hash is NULL, treat this as setting a new password
      if (!participant.password_hash) {
        // Validate password length
        if (password.length < 6) {
          setMessage("Password must be at least 6 characters");
          setLoading(false);
          return;
        }

        // Call set-password API
        const setPasswordResponse = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participantId: selectedParticipantId,
            password: password,
          }),
        });

        const setPasswordData = await setPasswordResponse.json();

        if (!setPasswordResponse.ok) {
          setMessage(setPasswordData.error || "Failed to set password");
          setLoading(false);
          return;
        }

        // After setting password, automatically log in
        // Store participant_id in localStorage
        localStorage.setItem("participant_id", setPasswordData.participantId);

        // Redirect to team home page
        router.push(`/team/${setPasswordData.participantId}`);
        return;
      }

      // If password_hash exists, call login API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: selectedParticipantId,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Store participant_id in localStorage
      localStorage.setItem("participant_id", data.participantId);

      // Redirect to team home page
      router.push(`/team/${data.participantId}`);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            2026 ANZ Super Rugby Picks Competition
          </h1>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Team
              </label>
              <select
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                required
              >
                <option value="">Select your team</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                required
              />
            </div>

            {message && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-green-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className="mt-4">
            <Link
              href="/register"
              className="flex w-full items-center justify-center rounded-md bg-[#007DBA] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#005F8E]"
            >
              Register
            </Link>
          </div>
          <div className="mt-3 text-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center rounded-md bg-[#007DBA] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#005F8E]"
            >
              Admin login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
