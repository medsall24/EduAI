
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { rolePermissionFindFirst } = vi.hoisted(() => ({
  rolePermissionFindFirst: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    rolePermission: {
      findFirst: rolePermissionFindFirst,
    },
  },
}));

import { requirePermission } from "../src/middlewares/permission.middleware.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";

function createMocks(user?: Request["user"]) {
  const req = {
    user,
  } as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe("requirePermission middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie 401 si l'utilisateur n'est pas authentifié", async () => {
    const { req, res, next } = createMocks(undefined);

    await requirePermission("ai.chat")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication required",
    });
    expect(rolePermissionFindFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("autorise le SUPER_ADMIN sans consulter les permissions du tenant", async () => {
    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: null,
      roleId: null,
      systemRole: "SUPER_ADMIN",
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(rolePermissionFindFirst).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("renvoie 403 si le tenant ou le rôle manque", async () => {
    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: null,
      roleId,
      systemRole: null,
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "User role or tenant context is missing",
      }),
    );
    expect(rolePermissionFindFirst).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

    it("refuse la permission si aucun rôle correspondant au tenant courant n'est trouvé", async () => {
    const roleIdFromAnotherTenant = "44444444-4444-4444-8444-444444444444";

    rolePermissionFindFirst.mockResolvedValue(null);

    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId,
      roleId: roleIdFromAnotherTenant,
      systemRole: null,
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(rolePermissionFindFirst).toHaveBeenCalledWith({
      where: {
        roleId: roleIdFromAnotherTenant,
        role: {
          tenantId,
        },
        permission: {
          name: "ai.chat",
        },
      },
      select: {
        roleId: true,
      },
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Forbidden: permission denied",
      }),
    );

    expect(res.status).not.toHaveBeenCalled();
  });

  it("renvoie 403 si le rôle ne possède pas la permission demandée", async () => {
    rolePermissionFindFirst.mockResolvedValue(null);

    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId,
      roleId,
      systemRole: null,
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(rolePermissionFindFirst).toHaveBeenCalledWith({
      where: {
        roleId,
        role: {
          tenantId,
        },
        permission: {
          name: "ai.chat",
        },
      },
      select: {
        roleId: true,
      },
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Forbidden: permission denied",
      }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("autorise un rôle qui possède la permission dans le tenant courant", async () => {
    rolePermissionFindFirst.mockResolvedValue({ roleId });

    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId,
      roleId,
      systemRole: null,
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(rolePermissionFindFirst).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("transmet les erreurs de base de données au gestionnaire central", async () => {
    const databaseError = new Error("Erreur PostgreSQL simulée");
    rolePermissionFindFirst.mockRejectedValue(databaseError);

    const { req, res, next } = createMocks({
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId,
      roleId,
      systemRole: null,
    });

    await requirePermission("ai.chat")(req, res, next);

    expect(next).toHaveBeenCalledWith(databaseError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
