
import { beforeEach, describe, expect, it, vi } from "vitest";

const { roleFindFirst, userFindUnique, userCreate, userFindFirst, userUpdate } =
  vi.hoisted(() => ({
    roleFindFirst: vi.fn(),
    userFindUnique: vi.fn(),
    userCreate: vi.fn(),
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
  }));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    role: {
      findFirst: roleFindFirst,
    },
    user: {
      findUnique: userFindUnique,
      create: userCreate,
      findFirst: userFindFirst,
      update: userUpdate,
    },
  },
}));

vi.mock("../src/services/password.service.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hash-test"),
}));

import { UserService } from "../src/modules/users/user.service.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const donneesCreation = {
  firstName: "Test",
  lastName: "Utilisateur",
  email: "test@example.com",
  password: "MotDePasse123",
  roleId,
};

describe("UserService — attribution des rôles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse la création d'un utilisateur avec le rôle TENANT_ADMIN", async () => {
    roleFindFirst.mockResolvedValue({
      id: roleId,
      name: "TENANT_ADMIN",
    });

    const service = new UserService();

    await expect(
      service.create(tenantId, donneesCreation),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(userCreate).not.toHaveBeenCalled();
  });

  it("refuse la modification vers le rôle TENANT_ADMIN", async () => {
    roleFindFirst.mockResolvedValue({
      id: roleId,
      name: "TENANT_ADMIN",
    });
    userFindFirst.mockResolvedValue({
      id: userId,
      tenantId,
      roleId,
    });

    const service = new UserService();

    await expect(
      service.update(tenantId, userId, { roleId }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("refuse un rôle qui n'appartient pas au tenant courant", async () => {
    roleFindFirst.mockResolvedValue(null);

    const service = new UserService();

    await expect(
      service.create(tenantId, donneesCreation),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(userCreate).not.toHaveBeenCalled();
  });

  it.each(["APPRENANT", "FORMATEUR"])(
  "autorise la création d'un utilisateur avec le rôle %s",
  async (roleName) => {
    roleFindFirst.mockResolvedValue({
      id: roleId,
      name: roleName,
    });
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({
      id: userId,
      tenantId,
      roleId,
      firstName: "Test",
      lastName: "Utilisateur",
      email: "test@example.com",
    });

    const service = new UserService();

    await expect(
      service.create(tenantId, donneesCreation),
    ).resolves.toBeDefined();

    expect(userCreate).toHaveBeenCalledOnce();
  },
);
});
