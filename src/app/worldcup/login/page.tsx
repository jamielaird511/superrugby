"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

const FIFA_WORLD_CUP_2026_COMPETITION_ID =
  "9e60564e-4be5-4756-b6cb-48ae06f45654";
const STORAGE_KEY = "worldcup_participant_id";

type Participant = {
  id: string;
  name: string;
  team_name: string;
};

export default function FifaWorldCup2026LoginPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function fetchParticipants() {
    try {
      const res = await fetch("/api/worldcup/participants");
      const json = (await res.json()) as {
        participants?: Participant[];
        error?: string;
      };
      if (!res.ok) {
        setMessage(json.error || "Error loading entrants");
        return;
      }
      const participants = json.participants || [];
      console.log("Loaded World Cup participants", participants);
      setParticipants(participants);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  useEffect(() => {
    (async () => {
      await fetchParticipants();
    })();
  }, []);

  useEffect(() => {
    const src =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("src")
        : null;
    track("landing_view", {
      metadata: { src, page: "worldcup_login", competitionId: FIFA_WORLD_CUP_2026_COMPETITION_ID },
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!selectedParticipantId) {
        setMessage("Please select your name");
        setLoading(false);
        return;
      }

      if (!password) {
        setMessage("Please enter a password");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/worldcup/login", {
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

      track("login_success", {
        participantId: selectedParticipantId,
        metadata: { page: "worldcup_login", competitionId: FIFA_WORLD_CUP_2026_COMPETITION_ID },
      });

      localStorage.setItem(STORAGE_KEY, selectedParticipantId);
      router.push(`/worldcup/team/${selectedParticipantId}`);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-[420px] px-4">
        <div className="rounded-lg border border-[#D6E3EC] bg-white p-6 shadow-sm">
          <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-[#C6A349]">
            FIFA World Cup 2026
          </div>
          <h1 className="mb-4 text-center text-xl font-semibold text-[#003A5D]">
            FIFA World Cup 2026 Picks Login
          </h1>

          <form onSubmit={handleLogin} className="space-y-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Your name
              </label>
              <select
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
              >
                <option value="">Select your name</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
              {participants.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">No World Cup participants found.</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
              />
            </div>

            {message && <div className="text-sm text-red-600">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
          <div className="mt-2">
            <Link
              href="/worldcup/register"
              className="flex h-10 w-full items-center justify-center rounded-md bg-[#007DBA] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#005F8E]"
            >
              Register
            </Link>
          </div>
          <p className="mt-3 text-center text-sm text-zinc-600">
            <Link href="/worldcup/register" className="text-[#003A5D] underline hover:text-[#005F8E]">
              New here? Register for the World Cup picks comp
            </Link>
          </p>

          <div className="mt-3 text-center">
            <Link
              href="/admin-login"
              className="inline-flex items-center justify-center rounded-md bg-[#003A5D] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#005F8E]"
            >
              Admin login
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500">
            <Link href="/" className="text-[#0B1F3A] underline hover:text-[#152a45]">
              Super Rugby competition login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
