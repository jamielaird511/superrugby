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

export default function AdminEmailsPage() {
  const [data, setData] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    </div>
  );
}
