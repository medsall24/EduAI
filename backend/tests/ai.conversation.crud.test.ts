
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  conversationCreate,
  conversationFindMany,
  conversationFindFirst,
  conversationUpdate,
  conversationDelete,
} = vi.hoisted(() => ({
  conversationCreate: vi.fn(),
  conversationFindMany: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  conversationDelete: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    aIConversation: {
      create: conversationCreate,
      findMany: conversationFindMany,
      findFirst: conversationFindFirst,
      update: conversationUpdate,
      delete: conversationDelete,
    },
  },
}));

import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
} from "../src/modules/ai/ai.conversation.service.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const anotherTenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const userId = "22222222-2222-4222-8222-222222222222";
const anotherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const conversationId = "33333333-3333-4333-8333-333333333333";

const context = {
  userId,
  tenantId,
  roleId: "44444444-4444-4444-8444-444444444444",
  systemRole: null,
};

const conversation = {
  id: conversationId,
  tenantId,
  userId,
  title: "Nouvelle conversation",
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AI conversation service — opérations CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createConversation", () => {
    it("crée une conversation pour l'utilisateur et le tenant courants", async () => {
      conversationCreate.mockResolvedValue(conversation);

      await createConversation(context, {
        title: "Cours de programmation",
      });

      expect(conversationCreate).toHaveBeenCalledOnce();
      expect(conversationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            userId,
            title: "Cours de programmation",
          }),
        }),
      );
    });

    it("refuse la création sans tenantId", async () => {
      await expect(
        createConversation(
          { ...context, tenantId: null } as never,
          { title: "Test" },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(conversationCreate).not.toHaveBeenCalled();
    });

    it("refuse la création sans userId", async () => {
      await expect(
        createConversation(
          { ...context, userId: null } as never,
          { title: "Test" },
        ),
      ).rejects.toMatchObject({ statusCode: 401 });

      expect(conversationCreate).not.toHaveBeenCalled();
    });
  });

  describe("listConversations", () => {
    it("limite la liste au tenant et à l'utilisateur courants", async () => {
      conversationFindMany.mockResolvedValue([conversation]);

      await listConversations(context);

      expect(conversationFindMany).toHaveBeenCalledOnce();
      expect(conversationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, userId },
        }),
      );
    });
  });

  describe("getConversation", () => {
    it("récupère une conversation appartenant à l'utilisateur courant", async () => {
      conversationFindFirst.mockResolvedValue(conversation);

      await getConversation(context, conversationId);

      expect(conversationFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: conversationId,
            tenantId,
            userId,
          }),
        }),
      );
    });

    it("refuse l'accès à une conversation inexistante ou étrangère", async () => {
      conversationFindFirst.mockResolvedValue(null);

      await expect(
        getConversation(context, conversationId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("updateConversation", () => {
    it("modifie le titre d'une conversation autorisée", async () => {
      conversationFindFirst.mockResolvedValue(conversation);
      conversationUpdate.mockResolvedValue({
        ...conversation,
        title: "Nouveau titre",
      });

      await updateConversation(context, conversationId, {
        title: "Nouveau titre",
      });

      expect(conversationUpdate).toHaveBeenCalledOnce();
      expect(conversationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Nouveau titre",
          }),
        }),
      );
    });

    it("archive une conversation autorisée", async () => {
      conversationFindFirst.mockResolvedValue(conversation);
      conversationUpdate.mockResolvedValue({
        ...conversation,
        isArchived: true,
      });

      await updateConversation(context, conversationId, {
        isArchived: true,
      });

      expect(conversationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isArchived: true,
          }),
        }),
      );
    });

    it("refuse la modification d'une conversation étrangère", async () => {
      conversationFindFirst.mockResolvedValue(null);

      await expect(
        updateConversation(context, conversationId, {
          title: "Modification interdite",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(conversationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("deleteConversation", () => {
    it("supprime une conversation autorisée", async () => {
      conversationFindFirst.mockResolvedValue(conversation);
      conversationDelete.mockResolvedValue(conversation);

      await deleteConversation(context, conversationId);

      expect(conversationDelete).toHaveBeenCalledOnce();
      expect(conversationDelete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_id: {
              tenantId,
              id: conversationId,
            },
          },
        }),
      );
    });

    it("refuse la suppression d'une conversation étrangère", async () => {
      conversationFindFirst.mockResolvedValue(null);

      await expect(
        deleteConversation(context, conversationId),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(conversationDelete).not.toHaveBeenCalled();
    });
  });
});
