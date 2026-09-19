import { describe, it, expect } from "vitest";
import {
  api,
  registerAdminAndGetCookie,
  createTeamMemberAndLogin,
  createEvent,
  insertFakePhoto,
} from "./helpers";

describe("Gallery publishing workflows", () => {
  describe("Gallery creation", () => {
    it("admin creates a gallery with auto-generated PIN shown once", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      const res = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Wedding Album" });

      expect(res.status).toBe(201);
      expect(res.body.data.gallery.title).toBe("Wedding Album");
      expect(res.body.data.gallery.status).toBe("draft");
      expect(res.body.data.gallery.public_token).toBeDefined();
      expect(res.body.data.pin).toMatch(/^\d{6}$/);
    });

    it("prevents creating a second gallery for the same event (409)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin2@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "First" });

      const res = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Second" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("GALLERY_ALREADY_EXISTS");
    });

    it("team member cannot create a gallery (403)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin3@g.com");
      const { cookie: teamCookie } = await createTeamMemberAndLogin(
        adminCookie,
        "team@g.com"
      );
      const eventId = await createEvent(adminCookie, "Event");

      const res = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", teamCookie)
        .send({ title: "Sneaky" });

      expect(res.status).toBe(403);
    });

    it("subsequent GET of gallery never includes the PIN", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin4@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      const createRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });

      const galleryId = createRes.body.data.gallery.gallery_id;

      const getRes = await api()
        .get(`/api/galleries/${galleryId}`)
        .set("Cookie", adminCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.gallery.pin).toBeUndefined();
      expect(getRes.body.data.pin).toBeUndefined();
    });
  });

  describe("Add photos to gallery", () => {
    it("adds photos and reports counts", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin5@g.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        adminCookie,
        "team5@g.com"
      );
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "p.jpg");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      const res = await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoId] });

      expect(res.status).toBe(200);
      expect(res.body.data.added).toBe(1);
      expect(res.body.data.already_in_gallery).toBe(0);
    });

    it("is idempotent — re-adding same photo returns already_in_gallery count", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin6@g.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        adminCookie,
        "team6@g.com"
      );
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "p.jpg");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoId] });

      const res = await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoId] });

      expect(res.status).toBe(200);
      expect(res.body.data.added).toBe(0);
      expect(res.body.data.already_in_gallery).toBe(1);
    });

    it("rejects cross-event photos (all-or-nothing with bad_photo_ids)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin7@g.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        adminCookie,
        "team7@g.com"
      );

      const event1 = await createEvent(adminCookie, "Event 1");
      const event2 = await createEvent(adminCookie, "Event 2");
      await api()
        .post(`/api/events/${event1}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });
      await api()
        .post(`/api/events/${event2}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoIn1 = await insertFakePhoto(event1, teamId, "e1.jpg");

      const galleryFor2 = await api()
        .post(`/api/events/${event2}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Event 2 Album" });
      const galleryId = galleryFor2.body.data.gallery.gallery_id;

      // Try to add event 1's photo to event 2's gallery
      const res = await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoIn1] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PHOTO_IDS");
      expect(res.body.error.details.bad_photo_ids).toContain(photoIn1);
    });

    it("rejects empty photo_ids array (validation error)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin8@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      const res = await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [] });

      expect(res.status).toBe(400);
    });
  });

  describe("Publish workflow", () => {
    it("blocks publishing an empty gallery (400 EMPTY_GALLERY)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin9@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Empty" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      const res = await api()
        .post(`/api/galleries/${galleryId}/publish`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("EMPTY_GALLERY");
    });

    it("publishes a non-empty gallery and returns published status", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin10@g.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        adminCookie,
        "team10@g.com"
      );
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "p.jpg");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoId] });

      const res = await api()
        .post(`/api/galleries/${galleryId}/publish`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.gallery.status).toBe("published");
      expect(res.body.data.gallery.published_at).toBeDefined();
    });

    it("prevents double-publish (409 ALREADY_PUBLISHED)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin11@g.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        adminCookie,
        "team11@g.com"
      );
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "p.jpg");

      const galleryRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = galleryRes.body.data.gallery.gallery_id;

      await api()
        .post(`/api/galleries/${galleryId}/photos`)
        .set("Cookie", adminCookie)
        .send({ photo_ids: [photoId] });

      await api()
        .post(`/api/galleries/${galleryId}/publish`)
        .set("Cookie", adminCookie);

      const res = await api()
        .post(`/api/galleries/${galleryId}/publish`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ALREADY_PUBLISHED");
    });
  });

  describe("PIN regeneration", () => {
    it("returns new PIN once, different from the original", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin12@g.com");
      const eventId = await createEvent(adminCookie, "Event");

      const createRes = await api()
        .post(`/api/events/${eventId}/gallery`)
        .set("Cookie", adminCookie)
        .send({ title: "Album" });
      const galleryId = createRes.body.data.gallery.gallery_id;
      const originalPin = createRes.body.data.pin;

      const res = await api()
        .post(`/api/galleries/${galleryId}/regenerate-pin`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.pin).toMatch(/^\d{6}$/);
      expect(res.body.data.pin).not.toBe(originalPin);
    });
  });
});