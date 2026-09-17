"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type PreviewData = {
  download_url: string;
  expires_at: string;
  filename: string;
  content_type: string;
};

/**
 * Fetch a presigned S3 URL for INLINE viewing of a photo (thumbnails,
 * lightbox). The URL has no Content-Disposition so the browser renders it.
 * Cached for 50 minutes (URL expires in 1 hour, we refetch before expiry).
 *
 * Works for both admin and team_member (backend does authorization).
 */
export function usePhotoPreview(photoId: string | undefined) {
  return useQuery({
    queryKey: ["photo-preview", photoId],
    queryFn: async () => {
      const res = await api.get<{ data: PreviewData }>(
        `/api/photos/${photoId}/preview-url`
      );
      return res.data.data;
    },
    enabled: !!photoId,
    staleTime: 50 * 60 * 1000, // 50 min
    gcTime: 55 * 60 * 1000,
  });
}

/**
 * Kick off a real browser download of a photo. Fetches a presigned URL
 * whose Content-Disposition forces attachment, then opens it in a new tab
 * so the browser saves the file. Opening in a new tab (rather than
 * navigating current tab) is the reliable cross-origin path: the browser
 * sees the attachment header, downloads, and closes the empty tab.
 *
 * Works for both admin and team_member.
 */
export function usePhotoDownload() {
  return useMutation({
    mutationFn: async (photoId: string) => {
      const res = await api.get<{ data: PreviewData }>(
        `/api/photos/${photoId}/download-url`
      );
      const { download_url, filename } = res.data.data;

      triggerBrowserDownload(download_url, filename);

      return res.data.data;
    },
  });
}

/**
 * Trigger a browser download of a URL whose server response has
 * Content-Disposition: attachment. Uses target=_blank so the current page
 * doesn't navigate away if the header is missing for some reason.
 * Exported for reuse from the customer download flow.
 */
export function triggerBrowserDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}