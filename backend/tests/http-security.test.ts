
import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";

// Importer la véritable application EduAI pour tester sa configuration
// HTTP, notamment le parseur JSON et le gestionnaire central d'erreurs.
import app from "../src/app.js";

describe("JSON body size protection", () => {
  it("should reject JSON bodies larger than 1 MB", async () => {
    // Envoyer un corps JSON dépassant la limite configurée dans app.ts.
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: "x".repeat(1_100_000) }));

    // Vérifier que l'application rejette le corps trop volumineux.
    expect(response.status).toBe(413);
  });

  it("should reject malformed JSON with HTTP 400", async () => {
    // Envoyer volontairement un document JSON syntaxiquement invalide.
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    // Une erreur de syntaxe JSON doit être considérée comme une erreur client.
    expect(response.status).toBe(400);
  });
});


 // Vérifier le comportement du rate limiter avec une limite réduite
 // pour éviter d'envoyer des centaines de requêtes pendant les tests.
describe("Rate limiting protection", () => {
  it("should return HTTP 429 when the request limit is exceeded", async () => {
    // Créer une application Express isolée pour ce test.
    const testApp = express();

    // Limiter à deux requêtes par fenêtre pour rendre le test rapide.
    testApp.use(
      rateLimit({
        windowMs: 60 * 1000,
        limit: 2,
        standardHeaders: "draft-8",
        legacyHeaders: false,
      }),
    );

    // Route de test qui répond normalement tant que la limite n'est pas atteinte.
    testApp.get("/test", (_req, res) => {
      res.status(200).json({ success: true });
    });

    // Les deux premières requêtes doivent être autorisées.
    const firstResponse = await request(testApp).get("/test");
    const secondResponse = await request(testApp).get("/test");

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    // La troisième requête dépasse la limite et doit être refusée.
    const thirdResponse = await request(testApp).get("/test");

    expect(thirdResponse.status).toBe(429);
  });
});
