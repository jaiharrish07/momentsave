"use client";

import Link from "next/link";
import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEvent } from "@/hooks/useEvents";
import { useMyPhotos, useUploadPhoto } from "@/hooks/usePhotos";
import { getErrorMessage } from "@/lib/api";
import { Photo } from "@/lib/types";

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

type UploadItem =
  | { key: string; filename: string; status: "uploading" }
  | { key: string; filename: string; status: "done"; photo: Photo }
  | { key: string; filename: string; status: "failed"; error: string };

export default function UploadPhotoPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const event = useEvent(eventId);
  const myPhotos = useMyPhotos(eventId);
  const upload = useUploadPhoto(eventId);

  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Team members only. Admins get bounced.
  if (user && user.role !== "team_member") {
    router.replace(`/events/${eventId}`);
    return null;
  }

  function validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: unsupported type (need JPEG/PNG/WebP/HEIC).`;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return `${file.name}: exceeds ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  }

  async function handleFiles(fileList: FileList | File[]) {
    setError(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const rejections: string[] = [];
    const accepted: File[] = [];
    for (const f of files) {
      const err = validate(f);
      if (err) rejections.push(err);
      else accepted.push(f);
    }
    if (rejections.length > 0) {
      setError(rejections.join(" · "));
    }

    // Seed queue with an entry per accepted file so the user sees progress.
    const newItems: UploadItem[] = accepted.map((f) => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
      filename: f.name,
      status: "uploading",
    }));
    if (newItems.length === 0) return;
    setItems((prev) => [...newItems, ...prev]);

    // Upload in parallel (each hits presign → S3 PUT → confirm).
    await Promise.all(
      accepted.map(async (file, i) => {
        const key = newItems[i].key;
        try {
          const photo = await upload.mutateAsync(file);
          setItems((prev) =>
            prev.map((it) =>
              it.key === key
                ? { key, filename: file.name, status: "done", photo }
                : it
            )
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it) =>
              it.key === key
                ? {
                    key,
                    filename: file.name,
                    status: "failed",
                    error: getErrorMessage(err),
                  }
                : it
            )
          );
        }
      })
    );

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  const activeCount = items.filter((i) => i.status === "uploading").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;

  return (
    <div>
      <Link
        href={`/events/${eventId}`}
        className="text-sm text-slate-500 hover:text-slate-900 mb-4 inline-block"
      >
        ← Back to event
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Upload photos
        </h1>
        {event.data && (
          <p className="text-sm text-slate-500 mt-1">
            to <span className="font-medium">{event.data.event_name}</span>
          </p>
        )}
      </div>

      <div className="max-w-lg">
        <label
          htmlFor="photo-input"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={`block border-2 border-dashed border-slate-200 rounded-lg p-10 text-center hover:border-slate-300 transition cursor-pointer ${
            activeCount > 0 ? "opacity-90" : ""
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="photo-input"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={onChange}
            disabled={activeCount > 0 && items.length > 20}
            className="hidden"
          />
          <span
            className={`inline-block px-5 py-2.5 rounded-lg font-medium transition ${
              activeCount > 0
                ? "bg-slate-100 text-slate-700"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {activeCount > 0
              ? `Uploading ${activeCount}...`
              : "Choose photos"}
          </span>
          <p className="text-sm text-slate-500 mt-4">
            Select multiple files or drag &amp; drop. JPEG, PNG, WebP, HEIC. Up
            to {MAX_FILE_SIZE_MB} MB each.
          </p>
        </label>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 whitespace-pre-line">
            {error}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-900">
                This session
              </h2>
              <p className="text-xs text-slate-500">
                {doneCount} done · {activeCount} uploading
                {failedCount > 0 && ` · ${failedCount} failed`}
              </p>
            </div>
            <ul className="space-y-2 max-h-80 overflow-auto pr-1">
              {items.map((it) => (
                <li
                  key={it.key}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                    it.status === "done"
                      ? "border-green-100 bg-green-50"
                      : it.status === "failed"
                        ? "border-red-100 bg-red-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="text-sm text-slate-900 truncate flex-1 min-w-0">
                    {it.filename}
                  </span>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      it.status === "done"
                        ? "text-green-700"
                        : it.status === "failed"
                          ? "text-red-700"
                          : "text-slate-500"
                    }`}
                    title={it.status === "failed" ? it.error : undefined}
                  >
                    {it.status === "done"
                      ? "Uploaded"
                      : it.status === "failed"
                        ? "Failed"
                        : "Uploading..."}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {myPhotos.data && myPhotos.data.photos.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h2 className="text-sm font-medium text-slate-900 mb-3">
              Your previous uploads ({myPhotos.data.total})
            </h2>
            <ul className="space-y-2">
              {myPhotos.data.photos.slice(0, 5).map((photo) => (
                <li
                  key={photo.photo_id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100"
                >
                  <span className="text-sm text-slate-700">{photo.filename}</span>
                  <span className="text-xs text-slate-500">
                    {formatBytes(photo.file_size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
