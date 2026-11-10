
/// <reference path="../src/types/express.d.ts" />

import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// Prépare les mocks avant leur utilisation par les modules importés.
const {
  userFindFirst,
  rolePermissionFindFirst,
  getLearnerPerformanceMock,
} = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  rolePermissionFindFirst: vi.fn(),
  getLearnerPerformanceMock: vi.fn(),
}));

// Simule Prisma pour ne pas dépendre d'une base de données réelle.
vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
    },
    rolePermission: {
      findFirst: rolePermissionFindFirst,
    },
  },
}));

// Utilise un secret exclusivement réservé aux tests.
vi.mock("../src/config/jwt.js", () => ({
  jwtConfig: {
    accessSecret: "test-access-secret-for-unit-tests",
  },
}));

// Isole le contrôleur de son service métier.
vi.mock("../src/modules/ai/ai.performance.service.js", () => ({
  getLearnerPerformance: getLearnerPerformanceMock,
}));

// Importe l'application après la déclaration des mocks.
import app from "../src/app.js";

const accessSecret = "test-access-secret-for-unit-tests";

const tenantId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const performanceResult = {
  generatedAt: "2026-11-10T20:00:00.000Z",
  summary: {
    totalAttempts: 2,
    totalQuizzes: 1,
    averagePercentage: 75,
    successRate: 50,
    passedAttempts: 1,
    failedAttempts: 1,
  },
  performanceByQuiz: [],
  performanceByLesson: [],
  performanceByFormation: [],
  questionAnalysis: {
    totalEvaluations: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unansweredQuestions: 0,
    strengths: [],
    difficulties: [],
  },
  attempts: [],
};

// Génère un véritable JWT de test compatible avec authenticate.
function createToken() {
  return jwt.sign(
    {
      userId,
      tenantId,
      roleId,
      systemRole: null,
    },
    accessSecret,
    { expiresIn: "15m" },
  );
}

// Configure les réponses simulées des contrôles d'authentification.
function mockAuthorizedLearner() {
  userFindFirst.mockResolvedValue({
    id: userId,
    tenantId,
    roleId,
    systemRole: null,
    isActive: true,
  });

  rolePermissionFindFirst.mockResolvedValue({
    roleId,
  });
}

describe("AI performance controller — intégration HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthorizedLearner();

    getLearnerPerformanceMock.mockResolvedValue(performanceResult);
  });

  it("refuse une requête sans token", async () => {
    const response = await request(app).get("/api/ai/performance");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(getLearnerPerformanceMock).not.toHaveBeenCalled();
  });

  it("refuse une requête avec un token invalide", async () => {
    const response = await request(app)
      .get("/api/ai/performance")
      .set("Authorization", "Bearer token-invalide");

    expect(response.status).toBe(401);
    expect(getLearnerPerformanceMock).not.toHaveBeenCalled();
  });

  it("refuse l'accès lorsque l'utilisateur est introuvable", async () => {
    userFindFirst.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/ai/performance")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(401);
    expect(rolePermissionFindFirst).not.toHaveBeenCalled();
    expect(getLearnerPerformanceMock).not.toHaveBeenCalled();
  });

  it("refuse l'accès lorsque la permission ai.chat est absente", async () => {
    rolePermissionFindFirst.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/ai/performance")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(403);
    expect(getLearnerPerformanceMock).not.toHaveBeenCalled();
  });

  it("retourne les performances de l'apprenant autorisé", async () => {
    const response = await request(app)
      .get("/api/ai/performance")
      .set("Authorization", `Bearer ${createToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: performanceResult,
    });

    expect(getLearnerPerformanceMock).toHaveBeenCalledOnce();
    expect(getLearnerPerformanceMock).toHaveBeenCalledWith({
      userId,
      tenantId,
      roleId,
      systemRole: null,
    });
  });

  it("transmet une erreur métier au gestionnaire central", async () => {
    getLearnerPerformanceMock.mockRejectedValue(
      Object.assign(new Error("Performance unavailable"), {
        statusCode: 503,
      }),
    );

    const response = await request(app)
      .get("/api/ai/performance")
      .set("Authorization", `Bearer ${createToken()}`);

    // Une erreur inconnue du gestionnaire central produit HTTP 500.
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: "Internal server error",
    });
  });
});
