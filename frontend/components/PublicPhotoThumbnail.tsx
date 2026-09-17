"use client";

import { usePublicPhotoPreview } from "@/hooks/usePublicGallery";

type Props = {
  publicToken: string;
  photoId: string;
  filename: string;
  onClick?: () => void;
};

/**
 * Thumbnail tile for a photo inside a public (customer) gallery.
 * Fetches an inline preview URL (session-gated) and displays it as an image.
 */
export function PublicPhotoThumbnail({
  publicToken,
  photoId,
  filename,
  onClick,
}: Props) {
  const { data, isLoading, error } = usePublicPhotoPreview(publicToken, photoId);

  const inner = (
    <div className="aspect-square rounded-md border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative group">
      {isLoading ? (
        <div className="text-[10px] text-slate-400">Loading...</div>
      ) : error || !data ? (
        <div className="text-center px-2">
          <p className="text-[10px] text-slate-500 truncate">{filename}</p>
          <p className="text-[10px] text-slate-400 mt-1">preview failed</p>
        </div>
      ) : (
        <>
          <img
            src={data.download_url}
            alt={filename}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {onClick && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          )}
        </>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-slate-400"
        aria-label={`View ${filename}`}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
