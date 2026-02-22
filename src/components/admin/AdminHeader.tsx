"use client";

import { supabase } from "@/lib/supabaseClient";

async function handleAdminLogout() {
  try {
    await supabase.auth.signOut();
  } finally {
    localStorage.removeItem("participant_id");
    localStorage.removeItem("admin_id");
    localStorage.removeItem("is_admin");
    window.location.href = "/";
  }
}

export default function AdminHeader() {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        Admin
      </h1>
      <button
        type="button"
        onClick={() => handleAdminLogout()}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Logout
      </button>
    </div>
  );
}
