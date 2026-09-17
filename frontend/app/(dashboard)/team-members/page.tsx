"use client";

import Link from "next/link";
import { useState, FormEvent, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useCreateTeamMember,
  useMyTeamMembers,
  useResetTeamMemberPassword,
} from "@/hooks/useTeamMembers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorMessage } from "@/lib/api";
import { User } from "@/lib/types";

export default function TeamMembersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const createMut = useCreateTeamMember();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<User[]>([]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const teamMembers = useMyTeamMembers(debouncedSearch);
  const isInitialLoad = teamMembers.isPending && teamMembers.data === undefined;
  const isSearching =
    (teamMembers.isFetching && teamMembers.data !== undefined) ||
    debouncedSearch !== search;

  const [resetTarget, setResetTarget] = useState<User | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/events");
    }
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const newUser = await createMut.mutateAsync({ name, email, password });
      setCreated((prev) => [newUser, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const list = teamMembers.data ?? [];

  return (
    <div>
      <Link
        href="/events"
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-block"
      >
        ← Back to events
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">
        Team members
      </h1>
      <p className="text-sm text-slate-500 mb-8 max-w-xl">
        Create team member accounts and manage the ones you own. Team members
        you create belong only to your account.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:ml-auto lg:max-w-4xl lg:pl-8">
        {/* Left — create form */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Create team member
          </h2>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-900 mb-1.5"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
                placeholder="Full name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-900 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
                placeholder="teammate@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-900 mb-1.5"
              >
                Initial password
              </label>
              <input
                id="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition font-mono"
                placeholder="At least 8 characters"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Share this with them. Can be reset from Manage teammates.
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 transition"
            >
              {createMut.isPending ? "Creating..." : "Create team member"}
            </button>
          </form>
        </section>

        {/* Right — session created */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Created this session
          </h2>

          {created.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">
                Team members you create will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {created.map((u) => (
                <li
                  key={u.user_id}
                  className="px-4 py-3 rounded-lg border border-green-100 bg-green-50"
                >
                  <p className="text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-600">{u.email}</p>
                  <p className="text-xs text-green-700 font-medium mt-1">
                    ID: {u.user_id}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {created.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
              Note the user IDs — you'll need them to add members to events.
            </p>
          )}
        </section>
      </div>

      {/* Manage teammates — profile + password reset */}
      <section className="mt-16 pt-10 border-t-2 border-slate-900">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            Manage teammates
          </h2>
          <p className="text-xs text-slate-500">
            {list.length} teammate{list.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-sm text-slate-500 mb-5 max-w-xl">
          View your team members and reset their passwords when they need one.
        </p>

        <div className="relative max-w-md mb-5">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="block w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
          />
          {isSearching && (
            <span
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
            >
              Searching...
            </span>
          )}
        </div>

        <div
          aria-busy={isSearching || undefined}
          className={isSearching ? "opacity-70 transition-opacity" : "transition-opacity"}
        >
        {isInitialLoad ? (
          <p className="text-sm text-slate-500">Loading teammates...</p>
        ) : teamMembers.error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {getErrorMessage(teamMembers.error)}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500">
              {debouncedSearch.trim()
                ? "No teammates match that search."
                : "You haven't created any teammates yet."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((t) => (
              <li
                key={t.user_id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white"
              >
                <div className="h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {t.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{t.email}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: {t.user_id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setResetTarget(t)}
                  className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 font-medium transition whitespace-nowrap"
                >
                  Reset password
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>

      {resetTarget && (
        <ResetPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: User;
  onClose: () => void;
}) {
  const resetMut = useResetTeamMemberPassword();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const isValid = useMemo(() => newPassword.length >= 8, [newPassword]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await resetMut.mutateAsync({
        teamMemberId: target.user_id,
        newPassword,
      });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function copyPassword() {
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6"
      >
        <div className="flex items-start justify-between mb-1">
          <h3 id="reset-title" className="text-base font-semibold text-slate-900">
            Reset password
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Set a new password for{" "}
          <span className="font-medium text-slate-800">{target.name}</span> (
          {target.email}). Share it with them securely.
        </p>

        {done ? (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">New password</p>
              <p className="text-lg font-mono font-semibold text-slate-900 break-all">
                {newPassword}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyPassword}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
              >
                {copied ? "Copied!" : "Copy password"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-slate-900 mb-1.5"
              >
                New password
              </label>
              <input
                id="new-password"
                type="text"
                required
                minLength={8}
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition font-mono"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || resetMut.isPending}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {resetMut.isPending ? "Resetting..." : "Reset password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
