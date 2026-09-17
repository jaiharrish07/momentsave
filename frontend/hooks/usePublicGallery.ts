"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PhotoInGallery, Paginated } from "@/lib/types";

/**
 * Get gallery preview before PIN entry.
 * Returns title only. 404 for unpublished/missing.
 */
export function usePublicGalleryPreview(publicToken: string) {
  return useQuery({
    queryKey: ["public-gallery", "preview", publicToken],
    queryFn: async () => {
      const res = await api.get<{ data: { gallery: { title: string } } }>(
        `/api/public/galleries/${publicToken}`
      );
      return res.data.data.gallery;
    },
    retry: false,
  });
}

/**
 * Submit PIN. On success, backend sets gallery session cookie.
 */
export function useVerifyPin(publicToken: string) {
  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await api.post<{
        data: { gallery: { title: string }; message: string };
      }>(`/api/public/galleries/${publicToken}/verify-pin`, { pin });
      return res.data.data;
    },
  });
}

/**
 * List photos in the gallery — requires the session cookie set by verify-pin.
 */
export function usePublicPhotos(publicToken: string, enabled: boolean) {
  return useQuery({
    queryKey: ["public-gallery", "photos", publicToken],
    queryFn: async () => {
      const res = await api.get<{ data: Paginated<"photos", PhotoInGallery> }>(
        `/api/public/galleries/${publicToken}/photos`
      );
      return res.data.data;
    },
    enabled,
    retry: false,
  });
}

/**
 * Fetch a presigned download URL for a specific photo.
 * Kicks off an actual download in the browser.
 */
export function useDownloadPhoto(publicToken: string) {
  return useMutation({
    mutationFn: async (photoId: string) => {
      const res = await api.get<{
        data: { download_url: string; expires_at: string; filename: string };
      }>(`/api/public/galleries/${publicToken}/photos/${photoId}/download`);
      return res.data.data;
    },
  });
}

/**
 * Fetch a presigned INLINE preview URL for a specific photo in a public
 * gallery. Used for thumbnails and lightbox display.
 * Cached for 50 minutes (URL expires in 1 hour).
 */
export function usePublicPhotoPreview(
  publicToken: string,
  photoId: string | undefined
) {
  return useQuery({
    queryKey: ["public-gallery", "photo-preview", publicToken, photoId],
    queryFn: async () => {
      const res = await api.get<{
        data: { download_url: string; expires_at: string; filename: string };
      }>(`/api/public/galleries/${publicToken}/photos/${photoId}/preview-url`);
      return res.data.data;
    },
    enabled: !!photoId,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
}