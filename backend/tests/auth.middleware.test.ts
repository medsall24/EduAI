/// <reference path="../src/types/express.d.ts" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const { userFindFirst } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
    },
  },
}));

vi.mock("../src/config/jwt.js", () => ({
  jwtConfig: {
    accessSecret: "test-access-secret-for-unit-tests",
  },
}));

import { authenticate } from "../src/middlewares/auth.middleware.js";

const accessSecret = "test-access-secret-for-unit-tests";

const validPayload = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

function createMocks(authorization?: string) {
  const req = {
    headers: authorization ? { authorization } : {},
  } as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

function createToken(payload: unknown = validPayload) {
  return jwt.sign(payload as object, accessSecret, {
    expiresIn: "15m",
  });
}

describe("authenticate middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie 401 si le Bearer token est absent", async () => {
    const { req, res, next } = createMocks();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication token is required",
    });
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("renvoie 401 si le token est invalide", async () => {
    const { req, res, next } = createMocks("Bearer token-invalide");

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired authentication token",
    });
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("renvoie 401 si le payload du token est malformé", async () => {
    const token = createToken({ userId: "pas-un-uuid" });
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid authentication token",
    });
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("renvoie 401 si l'utilisateur n'existe plus", async () => {
    userFindFirst.mockResolvedValue(null);

    const token = createToken();
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(userFindFirst).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication failed",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("renvoie 401 si le compte est désactivé", async () => {
    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: validPayload.roleId,
      systemRole: null,
      isActive: false,
    });

    const token = createToken();
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication failed",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte un utilisateur actif et recharge son contexte depuis la base", async () => {
    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: validPayload.roleId,
      systemRole: null,
      isActive: true,
    });

    const token = createToken();
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        id: validPayload.userId,
        tenantId: validPayload.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        systemRole: true,
        isActive: true,
      },
    });

    expect(req.user).toEqual({
      userId: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: validPayload.roleId,
      systemRole: null,
    });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

    it("refuse un SUPER_ADMIN avec un tenantId renseigné", async () => {
    const token = createToken({
      userId: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: null,
      systemRole: "SUPER_ADMIN",
    });

    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: null,
      systemRole: "SUPER_ADMIN",
      isActive: true,
    });

    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuse un SUPER_ADMIN avec un roleId renseigné", async () => {
    const token = createToken({
      userId: validPayload.userId,
      tenantId: null,
      roleId: validPayload.roleId,
      systemRole: "SUPER_ADMIN",
    });

    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: null,
      roleId: validPayload.roleId,
      systemRole: "SUPER_ADMIN",
      isActive: true,
    });

    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur ordinaire sans tenantId", async () => {
    const token = createToken({
      userId: validPayload.userId,
      tenantId: null,
      roleId: validPayload.roleId,
      systemRole: null,
    });

    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: null,
      roleId: validPayload.roleId,
      systemRole: null,
      isActive: true,
    });

    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur ordinaire sans roleId", async () => {
    const token = createToken({
      userId: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: null,
      systemRole: null,
    });

    userFindFirst.mockResolvedValue({
      id: validPayload.userId,
      tenantId: validPayload.tenantId,
      roleId: null,
      systemRole: null,
      isActive: true,
    });

    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepte un SUPER_ADMIN sans tenant ni rôle", async () => {
    const superAdminPayload = {
      userId: validPayload.userId,
      tenantId: null,
      roleId: null,
      systemRole: "SUPER_ADMIN" as const,
    };

    userFindFirst.mockResolvedValue({
      ...superAdminPayload,
      id: superAdminPayload.userId,
      isActive: true,
    });

    const token = createToken(superAdminPayload);
    const { req, res, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, res, next);

    expect(req.user).toEqual({
      userId: superAdminPayload.userId,
      tenantId: null,
      roleId: null,
      systemRole: "SUPER_ADMIN",
    });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
