"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type EmailRow = {
  participant_id: string;
  team_name: string | null;
  business_name: string | null;
  category: string | null;
  email: string;
  is_primary: boolean;
  receives_updates: boolean;
  created_at: string;
};

type ParticipantForReset = {
  id: string;
  team_name: string | null;
  category: string | null;
  primary_email: string | null;
};

export default function AdminEmailsPage() {
  const [data, setData] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Participants for reset-password
  const [participantsForReset, setParticipantsForReset] = useState<ParticipantForReset[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [resetConfirmTarget, setResetConfirmTarget] = useState<{ id: string; team_name: string } | null>(null);
  const [resetSuccessTempPassword, setResetSuccessTempPassword] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Filters
  const [onlyUpdates, setOnlyUpdates] = useState(true);
  const [includePrimary, setIncludePrimary] = useState(true);
  const [includeAdditional, setIncludeAdditional] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Get unique categories
  const categories = Array.from(
    new Set(data.map((row) => row.category).filter((c): c is string => c !== null))
  ).sort();

  useEffect(() => {
    fetchEmails();
  }, [onlyUpdates, includePrimary, includeAdditional, selectedCategory]);

  useEffect(() => {
    fetchParticipantsForReset();
  }, []);

  const fetchParticipantsForReset = async () => {
    try {
      setParticipantsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/admin/participants", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to fetch participants");
      }
      const result = await response.json();
      setParticipantsForReset(result.data || []);
    } catch (err) {
      console.error("Error fetching participants for reset:", err);
      setParticipantsForReset([]);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (!onlyUpdates) params.append("onlyUpdates", "0");
      if (!includePrimary) params.append("includePrimary", "0");
      if (!includeAdditional) params.append("includeAdditional", "0");
      if (selectedCategory) params.append("category", selectedCategory);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/admin/emails?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch emails");
      }

      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      console.error("Error fetching emails:", err);
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  };

  // Get unique emails (case-insensitive deduplication)
  const getUniqueEmails = (): string[] => {
    const emailMap = new Map<string, string>();
    data.forEach((row) => {
      const emailLower = row.email.toLowerCase();
      if (!emailMap.has(emailLower)) {
        emailMap.set(emailLower, row.email);
      }
    });
    return Array.from(emailMap.values());
  };

  const uniqueEmails = getUniqueEmails();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback: create textarea
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyBCC = () => {
    const bccText = uniqueEmails.join("; ");
    copyToClipboard(bccText);
  };

  const handleCopyLines = () => {
    const linesText = uniqueEmails.join("\n");
    copyToClipboard(linesText);
  };

  const handleResetConfirm = async () => {
    if (!resetConfirmTarget) return;
    try {
      setResetLoading(true);
      setResetError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ participantId: resetConfirmTarget.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Password reset failed");
      }
      setResetSuccessTempPassword(result.tempPassword ?? "");
      setResetConfirmTarget(null);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Email recipients
        </h1>
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          ← Back to Admin
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {resetError && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
          Reset password: {resetError}
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyUpdates}
              onChange={(e) => setOnlyUpdates(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Receives updates only
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={includePrimary}
              onChange={(e) => setIncludePrimary(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Include primary
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={includeAdditional}
              onChange={(e) => setIncludeAdditional(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Include additional
          </label>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700 dark:text-zinc-300">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Email count and copy buttons */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {uniqueEmails.length} {uniqueEmails.length === 1 ? "email" : "emails"}
        </div>
        <div className="flex items-center gap-2">
          {copied && (
            <span className="text-sm text-green-600 dark:text-green-400">Copied ✓</span>
          )}
          <button
            onClick={handleCopyBCC}
            disabled={loading || uniqueEmails.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Copy BCC
          </button>
          <button
            onClick={handleCopyLines}
            disabled={loading || uniqueEmails.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Copy as lines
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">Loading...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">No emails found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Business
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Primary
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Updates
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {data.map((row, index) => (
                  <tr key={`${row.participant_id}-${row.email}-${index}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {row.team_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {row.business_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {row.category
                        ? row.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {row.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {row.is_primary ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                          No
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {row.receives_updates ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset password section */}
      <div className="mt-10 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-lg font-semibold text-black dark:border-zinc-700 dark:text-zinc-50">
          Reset password
        </h2>
        {participantsLoading ? (
          <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">Loading participants...</div>
        ) : participantsForReset.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">No participants found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Primary email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {participantsForReset.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">{p.team_name || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {p.category ? p.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">{p.primary_email || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setResetConfirmTarget({ id: p.id, team_name: p.team_name ?? "—" })}
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset confirm modal */}
      {resetConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Reset password?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Generate a new temporary password for <strong>{resetConfirmTarget.team_name}</strong>. The team will need to use it to sign in and can change it in Settings.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmTarget(null)}
                disabled={resetLoading}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                disabled={resetLoading}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {resetLoading ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset success modal (temp password + Copy) */}
      {resetSuccessTempPassword !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Temporary password</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Copy this password and share it securely. The team can change it in Settings after signing in.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 font-mono text-sm dark:bg-zinc-800">
              <span className="flex-1 break-all text-zinc-900 dark:text-zinc-50">{resetSuccessTempPassword}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(resetSuccessTempPassword)}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setResetSuccessTempPassword(null)}
                className="rounded-md bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
