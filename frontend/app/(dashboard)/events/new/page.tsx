"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCreateEvent } from "@/hooks/useEvents";
import { getErrorMessage } from "@/lib/api";

export default function NewEventPage() {
  const router = useRouter();
  const { user } = useAuth();
  const createEvent = useCreateEvent();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/events");
    }
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const event = await createEvent.mutateAsync(name);
      router.replace(`/events/${event.event_id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/events"
        className="text-sm text-slate-500 hover:text-slate-900 mb-6 inline-block"
      >
        ← Back to events
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
        New event
      </h1>
      <p className="text-slate-500 mb-8">
        Give this event a name. You can add team members and photos after.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-900 mb-1.5"
          >
            Event name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
            placeholder="Arjun and Priya's Wedding"
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createEvent.isPending}
            className="px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 transition"
          >
            {createEvent.isPending ? "Creating..." : "Create event"}
          </button>
          <Link
            href="/events"
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
