"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Participant = {
  id: string;
  name: string;
  team_name: string;
  business_name: string;
};

export default function AdminPasswordsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [adminKey, setAdminKey] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchParticipants();
    // Load admin key from localStorage
    const storedKey = localStorage.getItem("admin_key");
    if (storedKey) {
      setAdminKey(storedKey);
    }
  }, []);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, team_name, business_name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching participants:", error);
        setMessage({ type: "error", text: `Error loading participants: ${error.message}` });
      } else {
        setParticipants(data || []);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({
        type: "error",
        text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  const handleSaveAdminKey = () => {
    if (adminKey.trim()) {
      localStorage.setItem("admin_key", adminKey.trim());
      setMessage({ type: "success", text: "Admin key saved" });
    }
  };

  const handleResetPassword = async (participantId: string) => {
    if (!adminKey.trim()) {
      setMessage({ type: "error", text: "Please enter and save admin key first" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim(),
        },
        body: JSON.stringify({ participantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to reset password" });
        setLoading(false);
        return;
      }

      setMessage({ type: "success", text: "Password reset successfully" });
      fetchParticipants(); // Refresh list
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({
        type: "error",
        text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            Admin - Password Management
          </h1>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg p-3 text-sm ${
              message.type === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Admin Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="Enter admin key"
            />
            <button
              onClick={handleSaveAdminKey}
              className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
            Participants
          </h2>
          {participants.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No participants found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Team Name
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Business Name
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant) => (
                    <tr
                      key={participant.id}
                      className="border-b border-zinc-200 dark:border-zinc-700"
                    >
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-50">
                        {participant.id}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-50">
                        {participant.name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-50">
                        {participant.team_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-zinc-900 dark:text-zinc-50">
                        {participant.business_name}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleResetPassword(participant.id)}
                          disabled={loading}
                          className="rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
