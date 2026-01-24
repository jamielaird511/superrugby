"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeamNav from "@/components/TeamNav";

type Participant = {
  id: string;
  business_name: string;
  team_name: string;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const participantId = params.id as string;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    localStorage.removeItem("participant_id");
    router.push("/");
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
      <TeamNav teamId={participantId} teamName={participant?.team_name || "Team"} onLogout={handleLogout} />

      <div className="py-8 pt-8">
        <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-3xl font-semibold text-[#003A5D] mb-4">Results</h1>
          <p className="text-zinc-600">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
