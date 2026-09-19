import { describe, it, expect } from "vitest";
import {
  api,
  registerAdminAndGetCookie,
  createTeamMemberAndLogin,
  createEvent,
  insertFakePhoto,
} from "./helpers";

/**
 * Helper — create a gallery, add a photo, publish it.
 * Returns { publicToken, pin, galleryId, teamId }
 */
async function setupPublishedGallery(): Promise<{
  publicToken: string;
  pin: string;
  galleryId: string;
  photoId: string;
  adminCookie: string;
}> {
  const adminCookie = await registerAdminAndGetCookie(
    `admin${Date.now()}@pg.com`
  );
  const { userId: teamId } = await createTeamMemberAndLogin(
    adminCookie,
    `team${Date.now()}@pg.com`
  );
  const eventId = await createEvent(adminCookie, "Event");
  await api()
    .post(`/api/events/${eventId}/members`)
    .set("Cookie", adminCookie)
    .send({ team_member_id: teamId });

  const photoId = await insertFakePhoto(eventId, teamId, "p.jpg");

  const createRes = await api()
    .post(`/api/events/${eventId}/gallery`)
    .set("Cookie", adminCookie)
    .send({ title: "Wedding Album" });

  const publicToken = createRes.body.data.gallery.public_token;
  const galleryId = createRes.body.data.gallery.gallery_id;
  const pin = createRes.body.data.pin;

  await api()
    .post(`/api/galleries/${galleryId}/photos`)
    .set("Cookie", adminCookie)
    .send({ photo_ids: [photoId] });

  await api()
    .post(`/api/galleries/${galleryId}/publish`)
    .set("Cookie", adminCookie);

  return { publicToken, pin, galleryId, photoId, adminCookie };
}

describe("PIN-protected access verification", () => {
  describe("Gallery preview (pre-PIN)", () => {
    it("returns only title for published gallery", async () => {
      const { publicToken } = await setupPublishedGallery();

      const res = await api().get(`/api/public/galleries/${publicToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gallery.title).toBe("Wedding Album");
      // Enumeration protection — no internal IDs leaked
      expect(res.body.data.gallery.gallery_id).toBeUndefined();
      expect(res.body.data.gallery.photo_count).toBeUndefined();
      expect(res.body.data.gallery.event_id).toBeUndefined();
    });

    it("returns 404 for a draft (unpublished) gallery", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin@pg2.com");
      const eventId = await createEvent(adminCookie, "Event");
      const createRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Draft Only" });

      const draftToken = createRes.body.data.gallery.public_token;

      const res = await api().get(`/api/public/galleries/${draftToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for a nonexistent public_token (same as draft)", async () => {
      const res = await api().get(
        "/api/public/galleries/absolutely-fake-token-12345"
      );

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PIN verification", () => {
    it("wrong PIN returns 401", async () => {
      const { publicToken } = await setupPublishedGallery();

      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin: "000000" });

      expect(res.status).toBe(401);
    });

    it("correct PIN returns session cookie", async () => {
      const { publicToken, pin } = await setupPublishedGallery();

      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin });

      expect(res.status).toBe(200);
      const cookieHeader = res.headers["set-cookie"];
      expect(cookieHeader).toBeDefined();
      const cookieString = Array.isArray(cookieHeader)
        ? cookieHeader.join("; ")
        : cookieHeader;
      expect(cookieString).toMatch(/momentsave_gallery_session_test=/);
      expect(cookieString).toMatch(/HttpOnly/i);
    });

    it("rejects PIN of wrong format (400)", async () => {
      const { publicToken } = await setupPublishedGallery();

      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin: "abc" });

      expect(res.status).toBe(400);
    });
  });

  describe("Photo access after PIN verification", () => {
    async function getSessionCookie(
      publicToken: string,
      pin: string
    ): Promise<string> {
      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin });
      const cookieHeader = res.headers["set-cookie"];
      const cookies = Array.isArray(cookieHeader)
        ? cookieHeader
        : [cookieHeader];
      return cookies.map((c) => c.split(";")[0]).join("; ");
    }

    it("lists photos after verifying with correct PIN", async () => {
      const { publicToken, pin } = await setupPublishedGallery();
      const cookie = await getSessionCookie(publicToken, pin);

      const res = await api()
        .get(`/api/public/galleries/${publicToken}/photos`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.photos.length).toBe(1);
      // No s3_key or event_id leaked
      const p = res.body.data.photos[0];
      expect(p.photo_id).toBeDefined();
      expect(p.filename).toBeDefined();
      expect(p.s3_key).toBeUndefined();
      expect(p.event_id).toBeUndefined();
    });

    it("blocks photos endpoint without gallery session cookie (401)", async () => {
      const { publicToken } = await setupPublishedGallery();

      const res = await api().get(
        `/api/public/galleries/${publicToken}/photos`
      );

      expect(res.status).toBe(401);
    });

    it("session for gallery A cannot view gallery B (403)", async () => {
      const galleryA = await setupPublishedGallery();
      const galleryB = await setupPublishedGallery();

      const cookieA = await getSessionCookie(galleryA.publicToken, galleryA.pin);

      const res = await api()
        .get(`/api/public/galleries/${galleryB.publicToken}/photos`)
        .set("Cookie", cookieA);

      expect(res.status).toBe(403);
    });

    it("customer can request presigned download URL for a photo in gallery", async () => {
      const { publicToken, pin, photoId } = await setupPublishedGallery();
      const cookie = await getSessionCookie(publicToken, pin);

      const res = await api()
        .get(`/api/public/galleries/${publicToken}/photos/${photoId}/download`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.download_url).toMatch(/^https:\/\//);
      expect(res.body.data.filename).toBe("p.jpg");
    });
  });

  describe("PIN rate limiting", () => {
    it("blocks after 5 wrong attempts with 429", async () => {
      const { publicToken } = await setupPublishedGallery();

      for (let i = 0; i < 5; i++) {
        const res = await api()
          .post(`/api/public/galleries/${publicToken}/verify-pin`)
          .send({ pin: "111111" });
        expect(res.status).toBe(401);
      }

      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin: "111111" });

      expect(res.status).toBe(429);
    });

    it("even correct PIN is blocked during the rate limit window", async () => {
      const { publicToken, pin } = await setupPublishedGallery();

      for (let i = 0; i < 6; i++) {
        await api()
          .post(`/api/public/galleries/${publicToken}/verify-pin`)
          .send({ pin: "111111" });
      }

      const res = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin });

      expect(res.status).toBe(429);
    });
  });

  describe("PIN regeneration invalidates sessions", () => {
    it("existing customer sessions become invalid after admin regenerates PIN", async () => {
      const { publicToken, pin, galleryId, adminCookie } =
        await setupPublishedGallery();

      // Customer verifies + gets a session
      const verifyRes = await api()
        .post(`/api/public/galleries/${publicToken}/verify-pin`)
        .send({ pin });
      const cookieHeader = verifyRes.headers["set-cookie"];
      const cookies = Array.isArray(cookieHeader)
        ? cookieHeader
        : [cookieHeader];
      const cookie = cookies.map((c) => c.split(";")[0]).join("; ");

      // Prove the session works
      const beforeRes = await api()
        .get(`/api/public/galleries/${publicToken}/photos`)
        .set("Cookie", cookie);
      expect(beforeRes.status).toBe(200);

      // Admin regenerates PIN
      await api()
        .post(`/api/galleries/${galleryId}/regenerate-pin`)
        .set("Cookie", adminCookie);

      // Old session cookie should no longer work
      const afterRes = await api()
        .get(`/api/public/galleries/${publicToken}/photos`)
        .set("Cookie", cookie);
      expect(afterRes.status).toBe(401);
    });
  });
});