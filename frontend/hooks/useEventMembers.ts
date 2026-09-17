"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EventMember } from "@/lib/types";

/**
 * List members of an event.
 * Backend returns 404 if requester cant access the event.
 */
export function useEventMembers(eventId: string | undefined) {
  return useQuery({
    queryKey: ["events", eventId, "members"],
    queryFn: async () => {
      const res = await api.get<{ data: { members: EventMember[] } }>(
        `/api/events/${eventId}/members`
      );
      return res.data.data.members;
    },
    enabled: !!eventId,
  });
}

/**
 * Admin adds a team member to their event.
 */
export function useAddEventMember(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamMemberId: string) => {
      const res = await api.post<{
        data: { membership: { event_id: string; user_id: string; joined_at: string } };
      }>(`/api/events/${eventId}/members`, { team_member_id: teamMemberId });
      return res.data.data.membership;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", eventId, "members"] });
    },
  });
}
