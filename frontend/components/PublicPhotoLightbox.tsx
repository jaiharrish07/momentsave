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
  publicToken: string;
  photos: PhotoRef[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
};

/**
 * Full-screen lightbox for the customer-facing public gallery.
 * Same UX as the authenticated PhotoLightbox but hits public endpoints.
 * Fetches both an inline preview URL (for the <img> slide) and an
 * attachment-headered download URL (for the Download plugin) in parallel.
 */
export function PublicPhotoLightbox({
  publicToken,
  photos,
  index,
  open,
  onClose,
  onIndexChange,
}: Props) {
  const previewQueries = useQueries({
    queries: photos.map((p) => ({
      queryKey: ["public-gallery", "photo-preview", publicToken, p.photo_id],
      queryFn: async () => {
        const res = await api.get<{
          data: { download_url: string; filename: string };
        }>(`/api/public/galleries/${publicToken}/photos/${p.photo_id}/preview-url`);
        return res.data.data;
      },
      enabled: open,
      staleTime: 50 * 60 * 1000,
    })),
  });

  const downloadQueries = useQueries({
    queries: photos.map((p) => ({
      queryKey: ["public-gallery", "photo-download", publicToken, p.photo_id],
      queryFn: async () => {
        const res = await api.get<{
          data: { download_url: string; filename: string };
        }>(`/api/public/galleries/${publicToken}/photos/${p.photo_id}/download`);
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
