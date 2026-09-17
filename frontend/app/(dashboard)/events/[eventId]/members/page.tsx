"use client";

import Link from "next/link";
import { use, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEvent } from "@/hooks/useEvents";
import { useEventMembers, useAddEventMember } from "@/hooks/useEventMembers";
import { useMyTeamMembers } from "@/hooks/useTeamMembers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorMessage } from "@/lib/api";

export default function EventMembersPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const event = useEvent(eventId);
  const members = useEventMembers(eventId);
  const addMember = useAddEventMember(eventId);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const teamMembers = useMyTeamMembers(debouncedSearch);
  const isInitialLoad = teamMembers.isPending && teamMembers.data === undefined;
  const isSearching =
    (teamMembers.isFetching && teamMembers.data !== undefined) ||
    debouncedSearch !== search;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addingCount, setAddingCount] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    added: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace(`/events/${eventId}`);
    }
  }, [user, eventId, router]);

  // Team members already assigned to this event — hide/mark them.
  const alreadyAssignedIds = useMemo(
    () => new Set((members.data ?? []).map((m) => m.user_id)),
    [members.data]
  );

  // Filter out those already in the event so admins can't try to re-add.
  const available = useMemo(
    () => (teamMembers.data ?? []).filter((t) => !alreadyAssignedIds.has(t.user_id)),
    [teamMembers.data, alreadyAssignedIds]
  );

  function toggle(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setLastResult(null);
  }

  async function onContinue() {
    setError(null);
    setLastResult(null);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setAddingCount(ids.length);
    let added = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const id of ids) {
      try {
        await addMember.mutateAsync(id);
        added += 1;
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 409) {
          skipped += 1;
        } else {
          failures.push(getErrorMessage(err));
        }
      }
    }

    setAddingCount(null);
    setSelectedIds(new Set());
    setLastResult({ added, skipped });
    if (failures.length > 0) {
      setError(failures.join(" · "));
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <div>
      <Link
        href={`/events/${eventId}`}
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-block"
      >
        ← Back to event
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Add People to Gallery
        </h1>
        <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
          Search your available team members and choose who should have access
          to this gallery.
          {event.data && (
            <>
              {" "}
              — <span className="font-medium text-slate-700">{event.data.event_name}</span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / center — picker */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <span
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {/* magnifier */}
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
              aria-label="Search team members"
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
            <p className="text-sm text-slate-500 py-6 text-center">
              Loading team members...
            </p>
          ) : teamMembers.error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {getErrorMessage(teamMembers.error)}
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">
                {debouncedSearch.trim()
                  ? "No team members match that search."
                  : (teamMembers.data?.length ?? 0) === 0
                    ? "You haven't created any team members yet."
                    : "All your team members are already in this event."}
              </p>
              {(teamMembers.data?.length ?? 0) === 0 && (
                <Link
                  href="/team-members"
                  className="inline-block mt-3 text-sm text-slate-900 font-medium underline underline-offset-2"
                >
                  Create your first team member
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {available.map((t) => {
                const selected = selectedIds.has(t.user_id);
                return (
                  <li key={t.user_id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.user_id)}
                      aria-pressed={selected}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition ${
                        selected
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {t.email}
                        </p>
                      </div>
                      <SelectionIndicator selected={selected} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {lastResult && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
              Added {lastResult.added} teammate{lastResult.added === 1 ? "" : "s"}
              {lastResult.skipped > 0 &&
                ` · ${lastResult.skipped} already in event`}
              .
            </div>
          )}

          <div className="sticky bottom-4 flex items-center justify-between gap-4 mt-6 p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
            <p className="text-sm text-slate-600">
              Selected:{" "}
              <span className="font-semibold text-slate-900">
                {selectedCount} teammate{selectedCount === 1 ? "" : "s"}
              </span>
            </p>
            <button
              type="button"
              onClick={onContinue}
              disabled={selectedCount === 0 || addingCount !== null}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {addingCount !== null
                ? `Adding ${addingCount}...`
                : "Continue"}
            </button>
          </div>
        </div>

        {/* Right — current members */}
        <section>
          <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">
            In this event ({members.data?.length ?? 0})
          </h2>

          {members.isLoading ? (
            <p className="text-sm text-slate-500">Loading members...</p>
          ) : members.data?.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">No members yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {members.data?.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100"
                >
                  <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {m.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SelectionIndicator({ selected }: { selected: boolean }) {
  return selected ? (
    <div
      aria-hidden
      className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  ) : (
    <div
      aria-hidden
      className="h-6 w-6 rounded-full border-2 border-slate-300 shrink-0"
    />
  );
}
