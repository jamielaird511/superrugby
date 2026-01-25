"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setCheckingAuth(false);
        return;
      }

      // Check if user email is in admin list
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];
      
      if (user.email && adminEmails.includes(user.email)) {
        // Already signed in and is admin - redirect to admin
        router.push("/admin");
        return;
      }

      // Signed in but not admin
      setCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!email || !password) {
        setMessage("Please enter both email and password");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message || "Login failed");
        setLoading(false);
        return;
      }

      // Check if user email is in admin list
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];
      
      if (!data.user?.email || !adminEmails.includes(data.user.email)) {
        setMessage("Not authorized. You must be an admin to access this page.");
        // Sign out the user since they're not authorized
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Success - redirect to admin
      router.push("/admin");
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-600">Checking authentication…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[420px] px-4">
        <div className="rounded-lg border border-[#D6E3EC] bg-white p-6 shadow-sm">
          <Link
            href="/"
            className="mb-3 inline-block text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>
          
          <h1 className="mb-4 text-center text-xl font-semibold text-[#003A5D]">
            Admin Login
          </h1>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black"
                required
                autoComplete="current-password"
              />
            </div>

            {message && (
              <div className="text-sm text-red-600">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
