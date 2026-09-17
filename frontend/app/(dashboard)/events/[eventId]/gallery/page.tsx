"use client";

import Link from "next/link";
import { use, useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEvent } from "@/hooks/useEvents";
import { useEventPhotos } from "@/hooks/usePhotos";
import {
  useGalleryForEvent,
  useCreateGallery,
  useAddPhotosToGallery,
  useRemovePhotoFromGallery,
  usePublishGallery,
  useRegeneratePin,
} from "@/hooks/useGalleries";
import { getErrorMessage } from "@/lib/api";
import { useGalleryPhotos } from "@/hooks/useGalleries";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";

export default function GalleryManagementPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const event = useEvent(eventId);
  const gallery = useGalleryForEvent(eventId);
  const eventPhotos = useEventPhotos(eventId);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace(`/events/${eventId}`);
    }
  }, [user, eventId, router]);

  if (event.isLoading || gallery.isLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  return (
    <div>
      <Link
        href={`/events/${eventId}`}
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-block"
      >
        ← Back to event
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Customer gallery
        </h1>
        {event.data && (
          <p className="text-slate-500 mt-1">
            for <span className="font-medium">{event.data.event_name}</span>
          </p>
        )}
      </div>
        
      {gallery.data === null ? (
        <CreateGalleryForm eventId={eventId} />
      ) : gallery.data ? (
        <GalleryEditor
          galleryId={gallery.data.gallery_id}
          eventId={eventId}
          gallery={gallery.data}
          
        />
      ) : null}
    </div>
  );
}

/* ---------- Create form (when no gallery exists yet) ---------- */

function CreateGalleryForm({ eventId }: { eventId: string }) {
  const createMut = useCreateGallery(eventId);
  const [title, setTitle] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await createMut.mutateAsync(title);
      setPin(result.pin);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (pin) {
    return <PinReveal pin={pin} context="Gallery created" />;
  }

  return (
    <div className="max-w-lg">
      <div className="p-6 border border-slate-200 rounded-lg">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Create gallery
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          A gallery is what customers see. It gets a 6-digit PIN which they'll
          need to view photos.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-900 mb-1.5"
            >
              Gallery title
            </label>
            <input
              id="title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full px-3 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
              placeholder="Arjun and Priya Wedding Album"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={createMut.isPending}
            className="px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 transition"
          >
            {createMut.isPending ? "Creating..." : "Create gallery"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Editor (gallery exists — manage photos, publish, PIN) ---------- */

type GalleryData = {
  gallery_id: string;
  event_id: string;
  title: string;
  public_token: string;
  status: "draft" | "published";
  photo_count: number;
  published_at: string | null;
};

function GalleryEditor({
  galleryId,
  eventId,
  gallery,
}: {
  galleryId: string;
  eventId: string;
  gallery: GalleryData;
}) {
  const galleryPhotos = useGalleryPhotos(galleryId);
  const eventPhotos = useEventPhotos(eventId);
  const addMut = useAddPhotosToGallery(galleryId, eventId);
  const removeMut = useRemovePhotoFromGallery(galleryId, eventId);
  const publishMut = usePublishGallery(galleryId, eventId);
  const pinMut = useRegeneratePin(galleryId);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/gallery/${gallery.public_token}`
      : "";

  function toggle(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function onAddSelected() {
    setError(null);
    if (selectedIds.size === 0) return;
    try {
      await addMut.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onPublish() {
    setError(null);
    try {
      await publishMut.mutateAsync();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onRegeneratePin() {
    setError(null);
    try {
      const result = await pinMut.mutateAsync();
      setNewPin(result.pin);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (newPin) {
    return <PinReveal pin={newPin} context="PIN regenerated" onDone={() => setNewPin(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* Status bar */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {gallery.title}
            </h2>
            <StatusBadge status={gallery.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {gallery.photo_count} photo{gallery.photo_count !== 1 && "s"}
            {gallery.published_at &&
              ` · Published ${new Date(
                gallery.published_at
              ).toLocaleDateString()}`}
          </p>
        </div>

        <div className="flex gap-2">
          {gallery.status === "draft" && (
            <button
              onClick={onPublish}
              disabled={publishMut.isPending || gallery.photo_count === 0}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title={
                gallery.photo_count === 0
                  ? "Add at least one photo before publishing"
                  : ""
              }
            >
              {publishMut.isPending ? "Publishing..." : "Publish"}
            </button>
          )}
          <button
            onClick={onRegeneratePin}
            disabled={pinMut.isPending}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-900 text-sm font-medium hover:bg-slate-100 disabled:opacity-60 transition"
          >
            {pinMut.isPending ? "..." : "Regenerate PIN"}
          </button>
        </div>
      </div>

      {/* Share link — only if published */}
      {gallery.status === "published" && (
        <section>
          <h3 className="text-sm font-medium text-slate-900 mb-2">
            Share with customers
          </h3>
          <div className="flex gap-2">
            <input
              readOnly
              value={publicUrl}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-mono"
            />
            <button
              onClick={copyLink}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Customers will need the current PIN to view photos.
          </p>
        </section>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Add photos section */}
            {/* Photos already in gallery */}
      <section>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          In gallery ({galleryPhotos.data?.length ?? 0})
        </h3>

        {galleryPhotos.data?.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500">
              No photos in gallery yet. Add some below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {galleryPhotos.data?.map((photo) => (
              <div key={photo.photo_id} className="relative group">
                <PhotoThumbnail
                  photoId={photo.photo_id}
                  filename={photo.filename}
                />
                <button
                  onClick={() =>
                    removeMut.mutate(photo.photo_id, {
                      onError: (err) => setError(getErrorMessage(err)),
                    })
                  }
                  disabled={removeMut.isPending}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-sm text-sm font-medium opacity-0 group-hover:opacity-100 transition"
                  title="Remove from gallery"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add photos section */}
      <section className="pt-8 border-t border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Add more photos
          </h3>
          <button
            onClick={onAddSelected}
            disabled={addMut.isPending || selectedIds.size === 0}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {addMut.isPending
              ? "Adding..."
              : `Add ${selectedIds.size} to gallery`}
          </button>
        </div>

        {(() => {
          const inGalleryIds = new Set(
            (galleryPhotos.data ?? []).map((p) => p.photo_id)
          );
          const available = (eventPhotos.data?.photos ?? []).filter(
            (p) => !inGalleryIds.has(p.photo_id)
          );

          if (eventPhotos.isLoading) {
            return <p className="text-sm text-slate-500">Loading photos...</p>;
          }
          if (available.length === 0) {
            return (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">
                  All uploaded photos are already in the gallery.
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {available.map((photo) => (
                <button
                  key={photo.photo_id}
                  type="button"
                  onClick={() => toggle(photo.photo_id)}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition ${
                    selectedIds.has(photo.photo_id)
                      ? "border-slate-900"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <PhotoThumbnail
                    photoId={photo.photo_id}
                    filename={photo.filename}
                  />
                  {selectedIds.has(photo.photo_id) && (
                    <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                        ✓
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })()}
      </section>
    </div>
  );
}

/* ---------- PIN reveal — shown once ---------- */

function PinReveal({
  pin,
  context,
  onDone,
}: {
  pin: string;
  context: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <div className="p-6 border-2 border-slate-900 rounded-lg bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{context}</h2>
        <p className="text-sm text-slate-600 mb-5">
          Save this PIN now — it won't be shown again.
        </p>

        <div className="bg-white p-6 rounded-lg border border-slate-200 mb-4">
          <p className="text-4xl font-mono font-bold text-slate-900 tracking-widest text-center">
            {pin}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition"
          >
            {copied ? "Copied!" : "Copy PIN"}
          </button>
          {onDone && (
            <button
              onClick={onDone}
              className="px-4 py-2.5 rounded-lg border border-slate-200 font-medium hover:bg-slate-100 transition"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center mt-3">
        You can regenerate the PIN anytime — old customer sessions will be
        invalidated.
      </p>
    </div>
  );
}

/* ---------- Status badge ---------- */

function StatusBadge({ status }: { status: "draft" | "published" }) {
  const styles =
    status === "published"
      ? "bg-green-100 text-green-800"
      : "bg-slate-200 text-slate-700";

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded ${styles} capitalize`}
    >
      {status}
    </span>
  );
}