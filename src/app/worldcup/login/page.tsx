"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import { WORLD_CUP_PAGE_BACKGROUND, worldCupAuthPageContentShellClass, worldCupContentCardClass } from "@/lib/worldCupBranding";
import { worldCupParticipantSubtitle } from "@/lib/worldCupParticipantDisplay";

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

  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/worldcup/participants", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    void fetchParticipants();
  }, [fetchParticipants]);

  useEffect(() => {
    const refresh = () => void fetchParticipants();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchParticipants]);

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
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader />

      <div className="flex min-h-screen flex-col">
        <div className={`${worldCupAuthPageContentShellClass} flex flex-1 flex-col items-center`}>
          <div className="w-full max-w-md">
            <div className={worldCupContentCardClass}>
              <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-amber-700">
                FIFA World Cup 2026
              </div>
              <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Picks login
              </h1>
              <p className="mb-6 text-center text-sm text-slate-500">
                Sign in with the name you registered and your password.
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
                  <select
                    value={selectedParticipantId}
                    onChange={(e) => setSelectedParticipantId(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                    required
                  >
                    <option value="">Select your name</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {worldCupParticipantSubtitle(participant)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                    required
                  />
                </div>

                {message && <div className="text-sm text-red-600">{message}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full rounded-md bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Logging in…" : "Log in"}
                </button>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <Link
                  href="/worldcup/register"
                  className="flex h-10 w-full items-center justify-center rounded-md border-2 border-[#126BFF] bg-white px-4 py-2 text-sm font-semibold text-[#126BFF] transition-colors hover:bg-slate-50"
                >
                  Create an account
                </Link>
              </div>

              <div className="mt-6 flex justify-center">
                <Link
                  href="/worldcup/admin/login"
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:text-xs"
                >
                  Admin login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
