import request from "supertest";
import { createApp } from "../src/app";
import type { Express } from "express";

export const app: Express = createApp();

export function api() {
  return request(app);
}

/**
 * Register an admin and return the cookie for subsequent requests.
 */
export async function registerAdminAndGetCookie(
  email = "admin@test.com",
  password = "password123",
  name = "Test Admin"
): Promise<string> {
  const res = await api()
    .post("/api/auth/register")
    .send({ name, email, password });

  if (res.status !== 201) {
    throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const cookieHeader = res.headers["set-cookie"];
  if (!cookieHeader) throw new Error("No cookie in register response");
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

/**
 * Create a team member (as an admin) and return their credentials + user_id.
 */
export async function createTeamMemberAndLogin(
  adminCookie: string,
  email = "team@test.com",
  password = "teampass123",
  name = "Test Team"
): Promise<{ cookie: string; userId: string }> {
  const createRes = await api()
    .post("/api/team-members")
    .set("Cookie", adminCookie)
    .send({ name, email, password });

  if (createRes.status !== 201) {
    throw new Error(`Create team member failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }

  const userId = createRes.body.data.team_member.user_id;

  // Login as team member
  const loginRes = await api()
    .post("/api/auth/login")
    .send({ email, password });

  const cookieHeader = loginRes.headers["set-cookie"];
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");

  return { cookie, userId };
}

/**
 * Create an event (as admin) and return event_id.
 */
export async function createEvent(
  adminCookie: string,
  name = "Test Event"
): Promise<string> {
  const res = await api()
    .post("/api/events")
    .set("Cookie", adminCookie)
    .send({ name });

  if (res.status !== 201) {
    throw new Error(`Create event failed: ${res.status}`);
  }

  return res.body.data.event.event_id;
}

/**
 * Insert a fake "uploaded" photo directly via SQL, bypassing S3.
 * Used for tests that need photos to exist without actually uploading.
 */
export async function insertFakePhoto(
  eventId: string,
  uploaderId: string,
  filename = "test.jpg"
): Promise<string> {
  const { pool } = await import("../src/db/client");
  const result = await pool.query(
    `INSERT INTO photos (event_id, uploaded_by, filename, s3_key, file_size, content_type, photo_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING photo_id`,
    [
      BigInt(eventId),
      BigInt(uploaderId),
      filename,
      `events/${eventId}/photos/${filename}-${Date.now()}.jpg`,
      1024,
      "image/jpeg",
      "uploaded",
    ]
  );
  return result.rows[0].photo_id.toString();
}