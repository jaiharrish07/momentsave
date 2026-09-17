"use client";

import Link from "next/link";
import { use } from "react";
import { useAuth } from "@/lib/auth-context";
import { useEvent } from "@/hooks/useEvents";
import { useEventMembers } from "@/hooks/useEventMembers";
import { useMyPhotos, useEventPhotos } from "@/hooks/usePhotos";
import { getErrorMessage } from "@/lib/api";
import { useState } from "react";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { usePhotoDownload } from "@/hooks/usePhotoPreview";
export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const event = useEvent(eventId);
  const members = useEventMembers(eventId);
  const adminPhotos = useEventPhotos(isAdmin ? eventId : undefined);
  const teamPhotos = useMyPhotos(!isAdmin ? eventId : undefined);
  const photos = isAdmin ? adminPhotos : teamPhotos;
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadMut = usePhotoDownload();
  const photoList = photos.data?.photos ?? [];

  async function handleDownload(photoId: string) {
    setDownloadingId(photoId);
    try {
      await downloadMut.mutateAsync(photoId);
    } finally {
      setDownloadingId(null);
    }
  }
  if (event.isLoading) {
    return <p className="text-sm text-slate-500">Loading event...</p>;
  }

  if (event.error) {
    return (
      <div>
        <Link
          href="/events"
          className="text-sm text-slate-500 hover:text-slate-900 mb-6 inline-block"
        >
          ← Back to events
        </Link>
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-4 py-3">
          {getErrorMessage(event.error)}
        </div>
      </div>
    );
  }

  if (!event.data) return null;

  return (
    <div>
      <Link
        href="/events"
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-block"
      >
        ← Back to events
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {event.data.event_name}
          </h1>
          <p className="text-slate-500 mt-1">
            Created {new Date(event.data.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Photos section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {isAdmin ? "Photos in this event" : "My uploads"}
              </h2>
              {!isAdmin && (
                <Link
                  href={`/events/${eventId}/photos`}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
                >
                  Upload photo
                </Link>
              )}
            </div>

            {photos.isLoading ? (
              <p className="text-sm text-slate-500">Loading photos...</p>
            ) : photos.data?.photos.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
                <p className="text-slate-500">
                  {isAdmin
                    ? "No photos have been uploaded yet."
                    : "You haven't uploaded any photos yet."}
                </p>
              </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photoList.map((photo, i) => (
                  <div key={photo.photo_id} className="relative group">
                    <PhotoThumbnail
                      photoId={photo.photo_id}
                      filename={photo.filename}
                      onClick={() => setLightboxIndex(i)}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(photo.photo_id);
                      }}
                      disabled={downloadingId === photo.photo_id}
                      className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-medium shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-60 transition"
                      title="Download original"
                    >
                      {downloadingId === photo.photo_id
                        ? "Downloading..."
                        : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.data && photos.data.total > 0 && (
              <p className="text-sm text-slate-500 mt-3">
                {photos.data.total} photo{photos.data.total !== 1 && "s"}
              </p>
            )}
          </section>

          {/* Admin-only: Gallery section */}
          {isAdmin && (
            <section className="pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Customer gallery
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Publish selected photos with a PIN.
                  </p>
                </div>
                <Link
                  href={`/events/${eventId}/gallery`}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Manage gallery
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Members</h2>
              {isAdmin && (
                <Link
                  href={`/events/${eventId}/members`}
                  className="text-sm text-slate-900 font-medium underline underline-offset-2"
                >
                  Add
                </Link>
              )}
            </div>

            {members.isLoading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : members.data?.length === 0 ? (
              <p className="text-sm text-slate-500">
                No team members assigned yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.data?.map((m) => (
                  <li
                    key={m.user_id}
                    className="px-3 py-2 rounded-lg border border-slate-100"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {m.name}
                    </p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    <PhotoLightbox
        photos={photoList}
        index={lightboxIndex}
        open={lightboxIndex >= 0}
        onClose={() => setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function formatBytes(bytesStr: string): string {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}