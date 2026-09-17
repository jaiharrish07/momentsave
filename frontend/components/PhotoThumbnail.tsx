"use client";

import { usePhotoPreview } from "@/hooks/usePhotoPreview";

type Props = {
  photoId: string;
  filename: string;
  onClick?: () => void;
};

/**
 * A thumbnail tile for a photo. Fetches preview URL, displays as an image.
 * Renders a placeholder while loading, and click-through if onClick given.
 */
export function PhotoThumbnail({ photoId, filename, onClick }: Props) {
  const { data, isLoading, error } = usePhotoPreview(photoId);

  const inner = (
    <div className="aspect-square rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative group">
      {isLoading ? (
        <div className="text-xs text-slate-400">Loading...</div>
      ) : error || !data ? (
        <div className="text-center px-2">
          <p className="text-xs text-slate-500 truncate">{filename}</p>
          <p className="text-xs text-slate-400 mt-1">preview failed</p>
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
        className="block w-full text-left rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-slate-400"
        aria-label={`View ${filename}`}
      >
        {inner}
      </button>
    );
  }

  return inner;
}