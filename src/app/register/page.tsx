"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { label: "Accountant", value: "accountant" },
  { label: "Broker", value: "broker" },
  { label: "Financial Services", value: "financial_services" },
  { label: "Solicitor", value: "solicitor" },
  { label: "Valuer", value: "valuer" },
  { label: "Other", value: "other" },
];

export default function RegisterPage() {
  const [businessName, setBusinessName] = useState<string>("");
  const [businessCategory, setBusinessCategory] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [leagueCode, setLeagueCode] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [contactEmails, setContactEmails] = useState<string[]>([""]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: boolean;
    teamName?: boolean;
    category?: boolean;
    contactEmails?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
    leagueCode?: boolean;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const addEmailField = () => {
    setContactEmails([...contactEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    if (contactEmails.length > 1) {
      setContactEmails(contactEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...contactEmails];
    updated[index] = value;
    setContactEmails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const errors: typeof fieldErrors = {};

      // Validate required fields
      if (!businessName.trim()) {
        errors.businessName = true;
        setMessage({ type: "error", text: "Business name is required" });
      }

      if (!businessCategory) {
        errors.category = true;
        if (!errors.businessName) {
          setMessage({ type: "error", text: "Category is required" });
        }
      }

      if (!teamName.trim()) {
        errors.teamName = true;
        if (!errors.businessName && !errors.category) {
          setMessage({ type: "error", text: "Team name is required" });
        }
      }

      // Validate password
      if (!password || password.length < 6) {
        errors.password = true;
        setPasswordError("Password must be at least 6 characters");
      }

      if (password !== confirmPassword) {
        errors.confirmPassword = true;
        if (!errors.password) {
          setPasswordError("Passwords do not match");
        }
      }

      const validEmails = contactEmails.filter((email) => email.trim() !== "");
      if (validEmails.length === 0) {
        errors.contactEmails = true;
        if (!errors.businessName && !errors.category && !errors.teamName && !errors.password && !errors.confirmPassword) {
          setMessage({ type: "error", text: "At least one contact email is required" });
        }
      }

      // Validate league code
      if (!leagueCode.trim()) {
        errors.leagueCode = true;
        if (Object.keys(errors).length === 0) {
          setMessage({ type: "error", text: "League code is required" });
        }
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setIsSubmitting(false);
        return;
      }

      setPasswordError(null);

      // Call registration API
      const registerResponse = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          teamName: teamName.trim(),
          category: businessCategory,
          emails: validEmails,
          password: password,
          leagueCode: leagueCode.trim(),
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setMessage({
          type: "error",
          text: registerData.error || "Registration failed",
        });
        setIsSubmitting(false);
        return;
      }

      // Sign in with Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: registerData.authEmail,
        password: password,
      });

      if (signInError) {
        setMessage({
          type: "error",
          text: signInError.message || "Failed to sign in after registration",
        });
        setIsSubmitting(false);
        return;
      }

      // On success: redirect to team page
      router.push(`/team/${registerData.participantId}`);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({
        type: "error",
        text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border border-[#D6E3EC] bg-white p-6 shadow-sm">
          <Link href="/" className="mb-3 inline-flex items-center gap-2 h-10 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            ← Back to login
          </Link>
          <h1 className="mb-4 text-center text-xl font-semibold text-[#003A5D]">
            Register Your Team
          </h1>

          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (fieldErrors.businessName) {
                    setFieldErrors((prev) => ({ ...prev, businessName: false }));
                  }
                }}
                className={`h-10 w-full rounded-md border px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                  fieldErrors.businessName
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  if (fieldErrors.teamName) {
                    setFieldErrors((prev) => ({ ...prev, teamName: false }));
                  }
                }}
                className={`h-10 w-full rounded-md border px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                  fieldErrors.teamName
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={businessCategory}
                onChange={(e) => {
                  setBusinessCategory(e.target.value);
                  if (fieldErrors.category) {
                    setFieldErrors((prev) => ({ ...prev, category: false }));
                  }
                }}
                className={`h-10 w-full rounded-md border px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                  fieldErrors.category
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                required
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                League Code
              </label>
              <input
                type="text"
                value={leagueCode}
                onChange={(e) => {
                  setLeagueCode(e.target.value);
                  if (fieldErrors.leagueCode) {
                    setFieldErrors((prev) => ({ ...prev, leagueCode: false }));
                  }
                }}
                className={`h-10 w-full rounded-md border px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                  fieldErrors.leagueCode
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
                required
                placeholder="Enter league code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Emails
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                (To receive weekly updates and reminders)
              </p>
              <div className="space-y-2">
                {contactEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        updateEmail(index, e.target.value);
                        if (fieldErrors.contactEmails) {
                          setFieldErrors((prev) => ({ ...prev, contactEmails: false }));
                        }
                      }}
                      className={`h-10 flex-1 rounded-md border px-3 py-2 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                        fieldErrors.contactEmails
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                      placeholder="email@example.com"
                    />
                    {contactEmails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEmailField}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + Add Email
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Password
              </label>
              <p className="mt-1 mb-2 text-xs text-gray-500">
                Note: this is a team password. Don&apos;t use your internet banking password that you then have to share with your colleagues...
              </p>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: false }));
                    }
                  }}
                  className={`h-10 w-full rounded-md border px-3 py-2 pr-10 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                    fieldErrors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Minimum 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError(null);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: false }));
                    }
                  }}
                  className={`h-10 w-full rounded-md border px-3 py-2 pr-10 text-sm text-black dark:bg-zinc-800 dark:text-zinc-50 ${
                    fieldErrors.confirmPassword
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {passwordError}
                </p>
              )}
            </div>

            {message && (
              <div
                className={`text-sm ${
                  message.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Registering..." : "Register"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
