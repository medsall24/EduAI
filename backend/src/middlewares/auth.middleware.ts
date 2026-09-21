import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { jwtConfig } from "../config/jwt.js";
import { prisma } from "../config/prisma.js";
import type { AuthUser } from "../types/auth.types.js";


// Schéma de validation du contenu attendu dans un access token.
const authTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  roleId: z.string().uuid().nullable(),
  systemRole: z.literal("SUPER_ADMIN").nullable(),
});

// Middleware chargé de vérifier l'access token JWT et d'identifier l'utilisateur.
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  // Vérifie que l'en-tête Authorization contient bien un Bearer token.
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
    return;
  }

  const token = authorization.substring("Bearer ".length);

  try {
    // Vérifie la signature et la validité temporelle du JWT.
    const payload = jwt.verify(token, jwtConfig.accessSecret);

    if (typeof payload === "string") {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
      return;
    }

    const parsedPayload = authTokenPayloadSchema.safeParse(payload);

if (!parsedPayload.success) {
  res.status(401).json({
    success: false,
    message: "Invalid authentication token",
  });
  return;
}

const authUser: AuthUser = parsedPayload.data;

// Vérifie que l'utilisateur existe toujours et qu'il est actif.
const user = await prisma.user.findFirst({
  where: {
    id: authUser.userId,
    tenantId: authUser.tenantId,
  },
  select: {
    id: true,
    tenantId: true,
    roleId: true,
    systemRole: true,
    isActive: true,
  },
});

// Refuse l'accès si l'utilisateur n'existe plus ou a été désactivé.
if (!user || !user.isActive) {
  res.status(401).json({
    success: false,
    message: "Authentication failed",
  });
  return;
}

// Ajoute le contexte authentifié à la requête Express.
req.user = {
  userId: user.id,
  tenantId: user.tenantId,
  roleId: user.roleId,
  systemRole: user.systemRole,
};

next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};