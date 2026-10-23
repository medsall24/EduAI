
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

const originalCorsOrigins = process.env.CORS_ORIGINS;

process.env.CORS_ORIGINS = "https://eduai.example.com";

const { default: app } = await import("../src/app.js");

describe("HTTP security protections", () => {
  afterAll(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
  });

  it("should return the API health response", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "EduAI Backend API is running",
    });
  });

  it("should include Helmet security headers", async () => {
  const response = await request(app).get("/");

  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers["content-security-policy"]).toBeDefined();
  expect(response.headers["strict-transport-security"]).toBeDefined();
  expect(response.headers["x-dns-prefetch-control"]).toBe("off");
});

  it("should allow a configured CORS origin", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://eduai.example.com");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://eduai.example.com",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("should not authorize an unknown CORS origin", async () => {
    const response = await request(app)
      .get("/")
      .set("Origin", "https://untrusted.example.org");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("should allow requests without an Origin header", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
  });
});
