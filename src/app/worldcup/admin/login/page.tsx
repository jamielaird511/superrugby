"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-[420px] px-4">
        <div className="rounded-lg border border-[#D6E3EC] bg-white p-6 shadow-sm">
          <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-[#C6A349]">
            FIFA World Cup 2026
          </div>
          <h1 className="mb-4 text-center text-xl font-semibold text-[#003A5D]">
            Admin Login
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Admin email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Admin password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
              />
            </div>

            {message ? <p className="text-sm text-red-600">{message}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-[#003A5D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#005F8E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-zinc-500">
            <Link href="/worldcup/login" className="text-[#0B1F3A] underline hover:text-[#152a45]">
              Back to World Cup login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
