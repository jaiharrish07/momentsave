"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Event, Paginated } from "@/lib/types";

/**
 * List events visible to the requester.
 * Backend returns different results based on role — no filter needed here.
 */
export function useEvents(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["events", { page, limit }],
    queryFn: async () => {
      const res = await api.get<{ data: Paginated<"events", Event> }>(
        `/api/events?page=${page}&limit=${limit}`
      );
      return res.data.data;
    },
  });
}

/**
 * Get one event by ID.
 * Returns null (404 handled by throw) if the user cant see this event.
 */
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["events", eventId],
    queryFn: async () => {
      const res = await api.get<{ data: { event: Event } }>(`/api/events/${eventId}`);
      return res.data.data.event;
    },
    enabled: !!eventId,
  });
}

/**
 * Admin creates an event.
 */
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post<{ data: { event: Event } }>("/api/events", { name });
      return res.data.data.event;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
