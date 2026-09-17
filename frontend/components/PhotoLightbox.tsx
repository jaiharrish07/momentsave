"use client";

import { useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Download from "yet-another-react-lightbox/plugins/download";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";

type PhotoRef = {
  photo_id: string;
  filename: string;
};

type Props = {
  photos: PhotoRef[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

/**
 * Full-screen photo viewer:
 * - Left/right arrows to navigate
 * - Zoom in/out with mouse wheel or +/-
 * - Download button (top right)
 * - Escape to close
 * - Counter (1 of 5)
 *
 * Fetches all preview URLs in parallel via React Query.
 * URLs are cached per-photo across the app (same key as PhotoThumbnail).
 */
export function PhotoLightbox({
  photos,
  index,
  open,
  onClose,
  onIndexChange,
}: Props) {
  // Preview URLs (inline, for the <img> in the slide).
  const previewQueries = useQueries({
    queries: photos.map((p) => ({
      queryKey: ["photo-preview", p.photo_id],
      queryFn: async () => {
        const res = await api.get<{
          data: { download_url: string; filename: string };
        }>(`/api/photos/${p.photo_id}/preview-url`);
        return res.data.data;
      },
      enabled: open,
      staleTime: 50 * 60 * 1000,
    })),
  });

  // Download URLs (Content-Disposition: attachment) for the Download plugin,
  // so clicking the download icon actually saves the file instead of opening
  // the image in a new tab.
  const downloadQueries = useQueries({
    queries: photos.map((p) => ({
      queryKey: ["photo-download", p.photo_id],
      queryFn: async () => {
        const res = await api.get<{
          data: { download_url: string; filename: string };
        }>(`/api/photos/${p.photo_id}/download-url`);
        return res.data.data;
      },
      enabled: open,
      staleTime: 50 * 60 * 1000,
    })),
  });

  const slides = useMemo(() => {
    return photos.map((p, i) => {
      const preview = previewQueries[i];
      const download = downloadQueries[i];
      return {
        src: preview.data?.download_url ?? "",
        alt: p.filename,
        title: p.filename,
        download: download.data?.download_url
          ? { url: download.data.download_url, filename: p.filename }
          : undefined,
      };
    });
  }, [photos, previewQueries, downloadQueries]);

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      on={{
        view: ({ index: i }) => onIndexChange?.(i),
      }}
      plugins={[Zoom, Counter, Download]}
      zoom={{
        maxZoomPixelRatio: 5,
        scrollToZoom: true,
      }}
      carousel={{
        finite: false,
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      styles={{
        container: { backgroundColor: "rgba(15, 23, 42, 0.95)" },
      }}
    />
  );
}