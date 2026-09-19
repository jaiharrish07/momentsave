import { describe, it, expect } from "vitest";
import { api, registerAdminAndGetCookie, createTeamMemberAndLogin } from "./helpers";

describe("Authentication", () => {
  describe("POST /api/auth/register", () => {
    it("registers a new admin and sets session cookie", async () => {
      const res = await api()
        .post("/api/auth/register")
        .send({
          name: "Alice",
          email: "alice@example.com",
          password: "password123",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe("alice@example.com");
      expect(res.body.data.user.role).toBe("admin");
      expect(res.body.data.user.user_id).toBeDefined();

      // Cookie present with secure flags
      const cookieHeader = res.headers["set-cookie"];
      expect(cookieHeader).toBeDefined();
      const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
      expect(cookieString).toMatch(/HttpOnly/i);
    });

    it("rejects duplicate email with 409", async () => {
      await api().post("/api/auth/register").send({
        name: "First",
        email: "dup@example.com",
        password: "password123",
      });

      const res = await api().post("/api/auth/register").send({
        name: "Second",
        email: "dup@example.com",
        password: "password123",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_EXISTS");
    });

    it("rejects invalid email with 400", async () => {
      const res = await api().post("/api/auth/register").send({
        name: "Bad",
        email: "not-an-email",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects password shorter than 8 chars with 400", async () => {
      const res = await api().post("/api/auth/register").send({
        name: "Short",
        email: "short@example.com",
        password: "abc",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with correct credentials", async () => {
      await api().post("/api/auth/register").send({
        name: "Login",
        email: "login@example.com",
        password: "password123",
      });

      const res = await api().post("/api/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe("login@example.com");
    });

    it("returns 401 for wrong password (uniform message)", async () => {
      await api().post("/api/auth/register").send({
        name: "User",
        email: "user@example.com",
        password: "password123",
      });

      const res = await api().post("/api/auth/login").send({
        email: "user@example.com",
        password: "wrongwrong",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/invalid/i);
    });

    it("returns 401 for nonexistent email (same uniform message)", async () => {
      const res = await api().post("/api/auth/login").send({
        email: "nobody@example.com",
        password: "anything123",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/invalid/i);
    });
  });

  describe("Session middleware — whoami", () => {
    it("returns user info with valid session cookie", async () => {
      const cookie = await registerAdminAndGetCookie("me@example.com");
      const res = await api().get("/api/auth/me").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe("me@example.com");
    });

    it("returns 401 without a cookie", async () => {
      const res = await api().get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 with an invalid cookie", async () => {
      const res = await api()
        .get("/api/auth/me")
        .set("Cookie", "momentsave_session_test=invalid_token_value");

      expect(res.status).toBe(401);
    });
  });

  describe("Logout", () => {
    it("clears the session so subsequent requests are unauthenticated", async () => {
      const cookie = await registerAdminAndGetCookie("logout@example.com");

      const logoutRes = await api()
        .post("/api/auth/logout")
        .set("Cookie", cookie);
      expect(logoutRes.status).toBe(204);

      // Same cookie should now be invalid
      const meRes = await api().get("/api/auth/me").set("Cookie", cookie);
      expect(meRes.status).toBe(401);
    });
  });
});

describe("Authorization (RBAC)", () => {
  it("team member cannot create an event (admin only)", async () => {
    const adminCookie = await registerAdminAndGetCookie("admin@rbac.com");
    const { cookie: teamCookie } = await createTeamMemberAndLogin(adminCookie);

    const res = await api()
      .post("/api/events")
      .set("Cookie", teamCookie)
      .send({ name: "Sneaky Event" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("team member cannot create another team member", async () => {
    const adminCookie = await registerAdminAndGetCookie("admin2@rbac.com");
    const { cookie: teamCookie } = await createTeamMemberAndLogin(
      adminCookie,
      "team-rbac@test.com"
    );

    const res = await api()
      .post("/api/team-members")
      .set("Cookie", teamCookie)
      .send({
        name: "Another",
        email: "another@test.com",
        password: "password123",
      });

    expect(res.status).toBe(403);
  });

  it("admin cannot use team-member-only endpoints (upload photo)", async () => {
    const adminCookie = await registerAdminAndGetCookie("admin3@rbac.com");
    const eventId = await api()
      .post("/api/events")
      .set("Cookie", adminCookie)
      .send({ name: "Wedding" })
      .then((r) => r.body.data.event.event_id);

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

  it("reset-password endpoint returns 404 when target is not a team_member (hides admin)", async () => {
    const adminCookie = await registerAdminAndGetCookie("admin4@rbac.com");

    // Try to reset the admin's own password via team-member endpoint
    // First get admin's user_id
    const meRes = await api().get("/api/auth/me").set("Cookie", adminCookie);
    const adminId = meRes.body.data.user.user_id;

    const res = await api()
      .post(`/api/team-members/${adminId}/reset-password`)
      .set("Cookie", adminCookie)
      .send({ new_password: "hackedpass123" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Login rate limiting", () => {
  it("blocks after 5 failed attempts with 429", async () => {
    // 5 wrong attempts should each return 401
    for (let i = 0; i < 5; i++) {
      const res = await api().post("/api/auth/login").send({
        email: "ratelimit@example.com",
        password: "wrong-password",
      });
      expect(res.status).toBe(401);
    }

    // 6th attempt returns 429
    const res = await api().post("/api/auth/login").send({
      email: "ratelimit@example.com",
      password: "wrong-password",
    });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("does not affect a different email from the same IP", async () => {
    // Exhaust rate limit on one email
    for (let i = 0; i < 6; i++) {
      await api().post("/api/auth/login").send({
        email: "blocked@example.com",
        password: "wrong",
      });
    }

    // Register + try login on a different email — should NOT be blocked
    await api().post("/api/auth/register").send({
      name: "Different",
      email: "different@example.com",
      password: "password123",
    });

    const res = await api().post("/api/auth/login").send({
      email: "different@example.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
  });
});