"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

/**
 * Admin: list team members they own. Optional search filters by name/email.
 * Backend restricts to team members with `created_by_admin_id = adminId`.
 *
 * `placeholderData: (prev) => prev` keeps the last successful result visible
 * while a new search query is in flight, so the list doesn't unmount and the
 * layout doesn't collapse on each keystroke.
 */
export function useMyTeamMembers(search?: string) {
  const trimmed = search?.trim() ?? "";
  return useQuery({
    queryKey: ["team-members", { search: trimmed }],
    queryFn: async () => {
      const q = trimmed
        ? `?search=${encodeURIComponent(trimmed)}`
        : "";
      const res = await api.get<{ data: { team_members: User[] } }>(
        `/api/team-members${q}`
      );
      return res.data.data.team_members;
    },
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });
}

/**
 * Admin creates a team member account.
 */
export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      password: string;
    }) => {
      const res = await api.post<{ data: { team_member: User } }>(
        "/api/team-members",
        input
      );
      return res.data.data.team_member;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

/**
 * Admin resets a team member's password. Only the owning admin can call this.
 */
export function useResetTeamMemberPassword() {
  return useMutation({
    mutationFn: async (input: { teamMemberId: string; newPassword: string }) => {
      const res = await api.post<{
        data: { team_member_id: string; message: string };
      }>(`/api/team-members/${input.teamMemberId}/reset-password`, {
        new_password: input.newPassword,
      });
      return res.data.data;
    },
  });
}
