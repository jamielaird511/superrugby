"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WorldCupAdminHeader from "@/components/worldcup/WorldCupAdminHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAuthInputClass,
  worldCupAuthPageContentShellClass,
  worldCupContentCardClass,
  worldCupPrimaryButtonClass,
} from "@/lib/worldCupBranding";

export default function WorldCupAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    if (!email || !password) {
      setMessage("Email and password are required.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message || "Login failed.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Login failed.");
      setLoading(false);
      return;
    }

    const adminEmails =
      process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.includes(userEmailLower)) {
      await supabase.auth.signOut();
      setMessage("You are not authorized for World Cup admin.");
      setLoading(false);
      return;
    }

    router.push("/worldcup/admin");
  };

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupAdminHeader subtitle="Admin login" showTabs={false} />

      <div className={`${worldCupAuthPageContentShellClass} flex flex-col items-center`}>
        <div className="w-full max-w-md">
          <div className={worldCupContentCardClass}>
            <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-amber-700">
              FIFA World Cup 2026
            </div>
            <h1 className="mb-4 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Admin login
            </h1>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Admin email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Admin password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={worldCupAuthInputClass}
                  required
                />
              </div>

              {message ? <p className="text-sm text-red-600">{message}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className={worldCupPrimaryButtonClass}
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              <Link
                href="/worldcup/login"
                className="font-medium text-[#126BFF] hover:underline"
              >
                Back to World Cup login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
