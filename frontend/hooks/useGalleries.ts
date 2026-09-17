"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Gallery } from "@/lib/types";

export function useGallery(galleryId: string | undefined) {
  return useQuery({
    queryKey: ["galleries", galleryId],
    queryFn: async () => {
      const res = await api.get<{ data: { gallery: Gallery } }>(
        `/api/galleries/${galleryId}`
      );
      return res.data.data.gallery;
    },
    enabled: !!galleryId,
  });
}

export function useGalleryForEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["galleries", "by-event", eventId],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: { gallery: Gallery } }>(
          `/api/events/${eventId}/gallery`
        );
        return res.data.data.gallery;
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!eventId,
    retry: false,
  });
}

export function useCreateGallery(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const res = await api.post<{
        data: { gallery: Gallery; pin: string; message: string };
      }>(`/api/events/${eventId}/gallery`, { title });
      return res.data.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["galleries", data.gallery.gallery_id], data.gallery);
      qc.setQueryData(["galleries", "by-event", eventId], data.gallery);
    },
  });
}

export function useAddPhotosToGallery(galleryId: string, eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoIds: string[]) => {
      const res = await api.post<{
        data: { added: number; already_in_gallery: number };
      }>(`/api/galleries/${galleryId}/photos`, { photo_ids: photoIds });
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["galleries", galleryId] });
      qc.invalidateQueries({ queryKey: ["galleries", "by-event", eventId] });
      qc.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
    },
  });
}

export function useRemovePhotoFromGallery(galleryId: string, eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/api/galleries/${galleryId}/photos/${photoId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["galleries", galleryId] });
      qc.invalidateQueries({ queryKey: ["galleries", "by-event", eventId] });
      qc.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
    },
  });
}

export function usePublishGallery(galleryId: string, eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { gallery: Gallery } }>(
        `/api/galleries/${galleryId}/publish`
      );
      return res.data.data.gallery;
    },
    onSuccess: (gallery) => {
      qc.setQueryData(["galleries", galleryId], gallery);
      qc.setQueryData(["galleries", "by-event", eventId], gallery);
    },
  });
}

export function useRegeneratePin(galleryId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { pin: string; message: string } }>(
        `/api/galleries/${galleryId}/regenerate-pin`
      );
      return res.data.data;
    },
  });
}

export function useGalleryPhotos(galleryId: string | undefined) {
  return useQuery({
    queryKey: ["galleries", galleryId, "photos"],
    queryFn: async () => {
      const res = await api.get<{
        data: { photos: { photo_id: string; filename: string; file_size: string; content_type: string }[] };
      }>(`/api/galleries/${galleryId}/photos`);
      return res.data.data.photos;
    },
    enabled: !!galleryId,
  });
}