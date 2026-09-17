"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  usePublicGalleryPreview,
  usePublicPhotos,
  useDownloadPhoto,
} from "@/hooks/usePublicGallery";
import { triggerBrowserDownload } from "@/hooks/usePhotoPreview";
import { getErrorCode, getErrorMessage } from "@/lib/api";
import { PhotoInGallery } from "@/lib/types";
import { PublicPhotoThumbnail } from "@/components/PublicPhotoThumbnail";
import { PublicPhotoLightbox } from "@/components/PublicPhotoLightbox";

export default function GalleryViewPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = use(params);
  const router = useRouter();

  const preview = usePublicGalleryPreview(publicToken);
  const photos = usePublicPhotos(publicToken, true);
  const downloadMut = useDownloadPhoto(publicToken);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // If the photos request 401's, session expired — redirect back to PIN.
  useEffect(() => {
    if (photos.error) {
      const code = getErrorCode(photos.error);
      if (code === "UNAUTHORIZED") {
        router.replace(`/gallery/${publicToken}`);
      }
    }
  }, [photos.error, publicToken, router]);

  async function handleDownload(photo: PhotoInGallery) {
    setError(null);
    setDownloadingId(photo.photo_id);
    try {
      const result = await downloadMut.mutateAsync(photo.photo_id);
      triggerBrowserDownload(result.download_url, result.filename);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  const photoList = photos.data?.photos ?? [];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b-2 border-slate-900 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-slate-900 whitespace-nowrap hover:opacity-80 transition"
          >
            MomentSave
          </Link>
          {preview.data?.title && (
            <p className="text-xs text-slate-500 truncate">
              {preview.data.title}
            </p>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {preview.data?.title ?? "Gallery"}
            </h1>
            {photos.data && (
              <p className="text-xs text-slate-500 mt-1">
                {photos.data.total} photo{photos.data.total !== 1 && "s"} · Tap
                any photo to view full size
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {photos.isLoading ? (
            <p className="text-sm text-slate-500">Loading photos...</p>
          ) : photoList.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">
                This gallery has no photos yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
              {photoList.map((photo, i) => (
                <div key={photo.photo_id} className="relative group">
                  <PublicPhotoThumbnail
                    publicToken={publicToken}
                    photoId={photo.photo_id}
                    filename={photo.filename}
                    onClick={() => setLightboxIndex(i)}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(photo);
                    }}
                    disabled={downloadingId === photo.photo_id}
                    className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-md bg-slate-900/90 hover:bg-slate-900 text-white text-[10px] font-medium shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-60 transition"
                    title="Download original"
                    aria-label={`Download ${photo.filename}`}
                  >
                    {downloadingId === photo.photo_id ? "..." : "Download"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-100 px-6 py-4 text-center">
        <p className="text-xs text-slate-400">
          MomentSave — Photos shared with a PIN
        </p>
      </footer>

      <PublicPhotoLightbox
        publicToken={publicToken}
        photos={photoList}
        index={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
