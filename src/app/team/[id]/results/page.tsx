"use client";

import { useParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { PencilSquareIcon, ChartBarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";

type Participant = {
  id: string;
  business_name: string;
  team_name: string;
};

export default function ResultsPage() {
  const params = useParams();
  const pathname = usePathname();
  const participantId = params.id as string;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  const isActive = (path: string) => {
    return pathname === path;
  };

  useEffect(() => {
    if (participantId) {
      fetchParticipant();
    }
  }, [participantId]);

  const fetchParticipant = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, business_name, team_name")
        .eq("id", participantId)
        .single();

      if (error) throw error;
      setParticipant(data);
    } catch (err) {
      console.error("Error fetching participant:", err);
    } finally {
      setLoading(false);
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
      {/* Fixed Navigation Bar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[#002D47] bg-[#003A5D] shadow-md">
        <div className="mx-auto h-16 max-w-5xl px-6 flex items-center gap-4">
          {/* Left: ANZ Logo */}
          <div className="flex items-center flex-shrink-0">
            <img
              src="/brand/logo-anz.svg"
              alt="ANZ"
              className="h-10 w-auto"
            />
          </div>

          {/* Team Name Badge - Left-aligned after logo */}
          <div className="flex items-center min-w-0">
            <span className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 truncate cursor-default select-none">
              {participant?.team_name || "Team"}
            </span>
          </div>

          {/* Right: Navigation Links + Logout - Push to right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <Link
              href={`/team/${participantId}`}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 h-10 w-32 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#003A5D] ${
                isActive(`/team/${participantId}`)
                  ? "border-white bg-white text-[#003A5D]"
                  : "border-white/30 bg-transparent text-white hover:bg-white/15 hover:border-white/50"
              }`}
            >
              <PencilSquareIcon className="h-4 w-4" />
              Picks
            </Link>
            <Link
              href={`/team/${participantId}/results`}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 h-10 w-32 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#003A5D] ${
                isActive(`/team/${participantId}/results`)
                  ? "border-white bg-white text-[#003A5D]"
                  : "border-white/30 bg-transparent text-white hover:bg-white/15 hover:border-white/50"
              }`}
            >
              <ChartBarIcon className="h-4 w-4" />
              Results
            </Link>
            <Link
              href={`/team/${participantId}/settings`}
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 h-10 w-32 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#003A5D] ${
                isActive(`/team/${participantId}/settings`)
                  ? "border-white bg-white text-[#003A5D]"
                  : "border-white/30 bg-transparent text-white hover:bg-white/15 hover:border-white/50"
              }`}
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={async () => {
                localStorage.removeItem("participant_id");
                window.location.href = "/";
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#007DBA] px-4 h-10 w-32 text-sm font-medium text-white transition-colors whitespace-nowrap hover:bg-[#0099D4] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#003A5D]"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="py-8 pt-8">
        <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-3xl font-semibold text-[#003A5D] mb-4">Results</h1>
          <p className="text-zinc-600">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
