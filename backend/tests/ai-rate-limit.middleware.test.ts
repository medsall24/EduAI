/// <reference path="../src/types/express.d.ts" />
import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";

import { aiMessageRateLimit } from "../src/middlewares/ai-rate-limit.middleware.js";

// Identifiants de test distincts pour vérifier l'isolation des quotas.
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
// Identifiants supplémentaires pour isoler le quatrième test.
const TENANT_C = "44444444-4444-4444-8444-444444444444";
const TENANT_D = "55555555-5555-4555-8555-555555555555";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// Crée une application Express de test avec un utilisateur authentifié
// et le véritable limiteur utilisé par le module IA.
const createTestApp = (userId: string, tenantId: string) => {
  const testApp = express();

  // Simule le contexte utilisateur normalement ajouté par authenticate.
  testApp.use((req, _res, next) => {
    req.user = {
      userId,
      tenantId,
      roleId: "33333333-3333-4333-8333-333333333333",
      systemRole: null,
    };

    next();
  });

  // Applique le véritable limiteur de messages IA.
  testApp.post("/messages", aiMessageRateLimit, (_req, res) => {
    res.status(200).json({ success: true });
  });

  return testApp;
};

describe("AI message rate limiter", () => {
  it("autorise les 10 premières requêtes d'un utilisateur", async () => {
    // Prépare une application avec un utilisateur et un tenant précis.
    const testApp = createTestApp(USER_A, TENANT_A);

    // Vérifie que les 10 premières requêtes sont acceptées.
    for (let index = 0; index < 10; index++) {
      const response = await request(testApp).post("/messages");

      expect(response.status).toBe(200);
    }
  });

  it("refuse la 11e requête avec HTTP 429", async () => {
    // Utilise un utilisateur différent pour disposer d'un quota indépendant.
    const testApp = createTestApp(USER_B, TENANT_A);

    // Consomme les 10 requêtes autorisées.
    for (let index = 0; index < 10; index++) {
      await request(testApp).post("/messages");
    }

    // La requête suivante doit être refusée.
    const response = await request(testApp).post("/messages");

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
  });

  it("sépare les quotas entre deux utilisateurs du même tenant", async () => {
    // Chaque utilisateur possède son propre compteur.
    const firstUserApp = createTestApp(USER_A, TENANT_B);
    const secondUserApp = createTestApp(USER_B, TENANT_B);

    // Le premier utilisateur consomme entièrement son quota.
    for (let index = 0; index < 10; index++) {
      await request(firstUserApp).post("/messages");
    }

    // Le premier utilisateur dépasse sa limite.
    const firstUserResponse = await request(firstUserApp).post("/messages");

    expect(firstUserResponse.status).toBe(429);

    // Le second utilisateur conserve son propre quota.
    const secondUserResponse = await request(secondUserApp).post("/messages");

    expect(secondUserResponse.status).toBe(200);
  });

  it("sépare les quotas entre deux tenants différents", async () => {
    // Chaque tenant utilise une clé de limitation encore jamais utilisée.
    const firstTenantApp = createTestApp(USER_A, TENANT_C);
    const secondTenantApp = createTestApp(USER_A, TENANT_D);

    // Le premier tenant consomme entièrement son quota.
    for (let index = 0; index < 10; index++) {
      await request(firstTenantApp).post("/messages");
    }

    // Le premier tenant dépasse sa limite.
    const firstTenantResponse = await request(firstTenantApp).post("/messages");

    expect(firstTenantResponse.status).toBe(429);

    // Le second tenant dispose d'un compteur indépendant.
    const secondTenantResponse = await request(secondTenantApp).post("/messages");

    expect(secondTenantResponse.status).toBe(200);
  });
});