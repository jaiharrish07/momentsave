import { describe, it, expect } from "vitest";
import {
  api,
  registerAdminAndGetCookie,
  createTeamMemberAndLogin,
  createEvent,
  insertFakePhoto,
} from "./helpers";

describe("Photo access controls", () => {
  describe("Upload URL generation", () => {
    it("team member assigned to event gets an upload URL", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin@ph.com");
      const { cookie: teamCookie, userId: teamId } =
        await createTeamMemberAndLogin(adminCookie, "team@ph.com");
      const eventId = await createEvent(adminCookie, "Wedding");

      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const res = await api()
        .post(`/api/events/${eventId}/photos/upload-url`)
        .set("Cookie", teamCookie)
        .send({
          filename: "test.jpg",
          content_type: "image/jpeg",
          file_size: 1024,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.upload_url).toMatch(/^https:\/\//);
      expect(res.body.data.photo_id).toBeDefined();
      expect(res.body.data.expires_at).toBeDefined();
    });

    it("team member NOT assigned to event gets 404 (hides existence)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin2@ph.com");
      const { cookie: teamCookie } = await createTeamMemberAndLogin(
        adminCookie,
        "team2@ph.com"
      );
      const eventId = await createEvent(adminCookie, "Private Event");

      // Team member NOT added to event
      const res = await api()
        .post(`/api/events/${eventId}/photos/upload-url`)
        .set("Cookie", teamCookie)
        .send({
          filename: "test.jpg",
          content_type: "image/jpeg",
          file_size: 1024,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("admin cannot generate an upload URL (403)", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin3@ph.com");
      const eventId = await createEvent(adminCookie, "Event");

      const res = await api()
        .post(`/api/events/${eventId}/photos/upload-url`)
        .set("Cookie", adminCookie)
        .send({
          filename: "test.jpg",
          content_type: "image/jpeg",
          file_size: 1024,
        });

      expect(res.status).toBe(403);
    });

    it("rejects invalid content_type", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin4@ph.com");
      const { cookie: teamCookie, userId: teamId } =
        await createTeamMemberAndLogin(adminCookie, "team4@ph.com");
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const res = await api()
        .post(`/api/events/${eventId}/photos/upload-url`)
        .set("Cookie", teamCookie)
        .send({
          filename: "test.exe",
          content_type: "application/x-msdownload",
          file_size: 1024,
        });

      expect(res.status).toBe(400);
    });

    it("rejects files exceeding max size", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin5@ph.com");
      const { cookie: teamCookie, userId: teamId } =
        await createTeamMemberAndLogin(adminCookie, "team5@ph.com");
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const res = await api()
        .post(`/api/events/${eventId}/photos/upload-url`)
        .set("Cookie", teamCookie)
        .send({
          filename: "huge.jpg",
          content_type: "image/jpeg",
          file_size: 100 * 1024 * 1024, // 100 MB — exceeds 20 MB
        });

      expect(res.status).toBe(400);
    });
  });

  describe("Photo listing — role-aware", () => {
    it("team member sees only own uploads via /photos/mine", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin6@ph.com");
      const { cookie: aliceCookie, userId: aliceId } =
        await createTeamMemberAndLogin(adminCookie, "alice@ph.com");
      const { cookie: bobCookie, userId: bobId } =
        await createTeamMemberAndLogin(adminCookie, "bob@ph.com");
      const eventId = await createEvent(adminCookie, "Event");

      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: aliceId });
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: bobId });

      // Alice + Bob each have a photo
      await insertFakePhoto(eventId, aliceId, "alice.jpg");
      await insertFakePhoto(eventId, bobId, "bob.jpg");

      const res = await api()
        .get(`/api/events/${eventId}/photos/mine`)
        .set("Cookie", aliceCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.photos.length).toBe(1);
      expect(res.body.data.photos[0].filename).toBe("alice.jpg");
    });

    it("admin sees all photos in their event via /photos", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin7@ph.com");
      const { userId: aliceId } = await createTeamMemberAndLogin(
        adminCookie,
        "alice7@ph.com"
      );
      const { userId: bobId } = await createTeamMemberAndLogin(
        adminCookie,
        "bob7@ph.com"
      );
      const eventId = await createEvent(adminCookie, "Event");

      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: aliceId });
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: bobId });

      await insertFakePhoto(eventId, aliceId, "alice.jpg");
      await insertFakePhoto(eventId, bobId, "bob.jpg");

      const res = await api()
        .get(`/api/events/${eventId}/photos`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.photos.length).toBe(2);
    });
  });

  describe("Photo preview URL — access control", () => {
    it("team member gets preview URL for photo in event they belong to", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin8@ph.com");
      const { cookie: teamCookie, userId: teamId } =
        await createTeamMemberAndLogin(adminCookie, "team8@ph.com");
      const eventId = await createEvent(adminCookie, "Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "own.jpg");

      const res = await api()
        .get(`/api/photos/${photoId}/preview-url`)
        .set("Cookie", teamCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.download_url).toMatch(/^https:\/\//);
    });

    it("team member cannot preview a photo from an event they don't belong to", async () => {
      const adminCookie = await registerAdminAndGetCookie("admin9@ph.com");
      const { userId: aliceId } = await createTeamMemberAndLogin(
        adminCookie,
        "alice9@ph.com"
      );
      const { cookie: bobCookie } = await createTeamMemberAndLogin(
        adminCookie,
        "bob9@ph.com"
      );
      const eventId = await createEvent(adminCookie, "Alice's Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", adminCookie)
        .send({ team_member_id: aliceId });

      const photoId = await insertFakePhoto(eventId, aliceId, "alice.jpg");

      // Bob (not in event) tries to view
      const res = await api()
        .get(`/api/photos/${photoId}/preview-url`)
        .set("Cookie", bobCookie);

      expect(res.status).toBe(404);
    });

    it("admin cannot preview a photo from another admin's event (404 hides)", async () => {
      const admin1Cookie = await registerAdminAndGetCookie("owner@ph.com");
      const admin2Cookie = await registerAdminAndGetCookie("other-admin@ph.com");
      const { userId: teamId } = await createTeamMemberAndLogin(
        admin1Cookie,
        "team-other@ph.com"
      );
      const eventId = await createEvent(admin1Cookie, "Owner's Event");
      await api()
        .post(`/api/events/${eventId}/members`)
        .set("Cookie", admin1Cookie)
        .send({ team_member_id: teamId });

      const photoId = await insertFakePhoto(eventId, teamId, "private.jpg");

      const res = await api()
        .get(`/api/photos/${photoId}/preview-url`)
        .set("Cookie", admin2Cookie);

      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await api().get("/api/photos/1/preview-url");
      expect(res.status).toBe(401);
    });
  });
});