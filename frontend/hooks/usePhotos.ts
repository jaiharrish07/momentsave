"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Photo, Paginated } from "@/lib/types";
import { uploadPhoto } from "@/lib/s3-upload";

/**
 * Team member: list photos they uploaded to an event.
 */
export function useMyPhotos(eventId: string | undefined) {
  return useQuery({
    queryKey: ["photos", "mine", eventId],
    queryFn: async () => {
      const res = await api.get<{ data: Paginated<"photos", Photo> }>(
        `/api/events/${eventId}/photos/mine`
      );
      return res.data.data;
    },
    enabled: !!eventId,
  });
}

/**
 * Admin: list all photos in an event they own.
 */
export function useEventPhotos(eventId: string | undefined) {
  return useQuery({
    queryKey: ["photos", "all", eventId],
    queryFn: async () => {
      const res = await api.get<{ data: Paginated<"photos", Photo> }>(
        `/api/events/${eventId}/photos`
      );
      return res.data.data;
    },
    enabled: !!eventId,
  });
}

/**
 * Upload a photo via presigned URL flow.
 * The heavy lifting lives in lib/s3-upload.ts.
 */
export function useUploadPhoto(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => uploadPhoto(file, eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos", "mine", eventId] });
      qc.invalidateQueries({ queryKey: ["photos", "all", eventId] });
    },
  });
}
