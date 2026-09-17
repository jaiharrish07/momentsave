"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useEvents } from "@/hooks/useEvents";
import { getErrorMessage } from "@/lib/api";

export default function EventsPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useEvents();

  const isAdmin = user?.role === "admin";

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading events...</p>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
        {getErrorMessage(error)}
      </div>
    );
  }

  const events = data?.events ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Events
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? "Events you created."
              : "Events you're assigned to."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/events/new"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
          >
            New event
          </Link>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-lg">
          <p className="text-slate-500">
            {isAdmin
              ? "You haven't created any events yet."
              : "You aren't assigned to any events yet."}
          </p>
          {isAdmin && (
            <Link
              href="/events/new"
              className="inline-block mt-4 text-sm text-slate-900 font-medium underline underline-offset-2"
            >
              Create your first event
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link
              key={event.event_id}
              href={`/events/${event.event_id}`}
              className="block p-5 rounded-lg border border-slate-200 hover:border-slate-400 hover:shadow-sm transition"
            >
              <h3 className="font-semibold text-slate-900 mb-1">
                {event.event_name}
              </h3>
              <p className="text-sm text-slate-500">
                Created {new Date(event.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > events.length && (
        <p className="text-sm text-slate-500 text-center mt-6">
          Showing {events.length} of {data.total} events
        </p>
      )}
    </div>
  );
}
