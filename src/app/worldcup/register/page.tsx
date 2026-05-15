"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAuthInputClass,
  worldCupAuthPageContentShellClass,
  worldCupContentCardClass,
  worldCupPrimaryButtonClass,
} from "@/lib/worldCupBranding";
import { writeWorldCupParticipantId } from "@/lib/worldCupStorage";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WorldCupPublicRegisterPage() {
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

    if (!first) return setError("First name is required");
    if (!last) return setError("Last name is required");
    if (!mail) return setError("Email is required");
    if (!EMAIL_REGEX.test(mail)) return setError("Please enter a valid email address");
    if (!password) return setError("Password is required");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (!accessCode.trim()) return setError("Access code is required");

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

      const data = (await response.json()) as {
        participantId?: string;
        tenant?: string;
        error?: string;
      };
      if (!response.ok || !data.participantId || !data.tenant) {
        setError(data.error || "Failed to register");
        setLoading(false);
        return;
      }

      writeWorldCupParticipantId(data.tenant, data.participantId);
      router.push(`/worldcup/${data.tenant}/team/${data.participantId}`);
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
            <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Register
            </h1>
            <p className="mb-6 text-center text-sm text-slate-500">
              Enter the access code for the competition you are joining. Your code picks which World Cup
              pool you register in.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Access code</label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                  autoComplete="off"
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button type="submit" disabled={loading} className={worldCupPrimaryButtonClass}>
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
