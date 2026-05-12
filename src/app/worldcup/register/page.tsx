"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import { WORLD_CUP_PAGE_BACKGROUND, worldCupAuthPageContentShellClass, worldCupContentCardClass } from "@/lib/worldCupBranding";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_KEY = "worldcup_participant_id";

export default function WorldCupRegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim();

    if (!first) {
      setError("First name is required");
      return;
    }
    if (!last) {
      setError("Last name is required");
      return;
    }
    if (!mail) {
      setError("Email is required");
      return;
    }
    if (!EMAIL_REGEX.test(mail)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/worldcup/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          email: mail,
          password,
          accessCode: accessCode.trim(),
        }),
      });

      const data = (await response.json()) as { participantId?: string; error?: string };
      if (!response.ok || !data.participantId) {
        setError(data.error || "Failed to register");
        setLoading(false);
        return;
      }

      const participantId = data.participantId;
      localStorage.setItem(STORAGE_KEY, participantId);
      console.log("World Cup participant stored", participantId);
      router.push(`/worldcup/team/${participantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader />

      <div className={worldCupAuthPageContentShellClass}>
        <div className="mx-auto w-full max-w-md">
          <div className={worldCupContentCardClass}>
            <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-amber-700">
              FIFA World Cup 2026
            </div>
            <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Register
            </h1>
            <p className="mb-6 text-center text-sm text-slate-500">
              Create your account with the access code you were given.
            </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                required
              />
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Access code
              </label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30"
                required
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Registering…" : "Register"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            <Link href="/worldcup/login" className="font-medium text-[#126BFF] hover:underline">
              Already registered? Log in
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
