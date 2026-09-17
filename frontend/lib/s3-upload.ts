import axios from "axios";
import { api } from "./api";
import { Photo } from "./types";

/**
 * Full presigned-URL upload flow for a single photo.
 * Three-step: request URL from backend, PUT to S3, confirm to backend.
 *
 * Returns the confirmed photo on success.
 * Throws on any step failure.
 */
export async function uploadPhoto(
  file: File,
  eventId: string
): Promise<Photo> {
  // Step 1 — ask backend for a presigned URL.
  const uploadUrlRes = await api.post<{
    data: { photo_id: string; upload_url: string; expires_at: string };
  }>(`/api/events/${eventId}/photos/upload-url`, {
    filename: file.name,
    content_type: file.type,
    file_size: file.size,
  });

  const { photo_id, upload_url } = uploadUrlRes.data.data;

  // Step 2 — PUT bytes directly to S3. Uses raw axios (no withCredentials).
  await axios.put(upload_url, file, {
    headers: { "Content-Type": file.type },
    withCredentials: false,
  });

  // Step 3 — tell backend the upload succeeded so it can HEAD-verify and mark uploaded.
  const confirmRes = await api.post<{ data: { photo: Photo } }>(
    `/api/photos/${photo_id}/confirm`
  );

  return confirmRes.data.data.photo;
}
