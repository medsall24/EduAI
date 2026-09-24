import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/app-error.js";

export const requirePermission = (
  permissionName: string,
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Le SUPER_ADMIN dispose d'un accès global.
      if (req.user.systemRole === "SUPER_ADMIN") {
        next();
        return;
      }

      // Un utilisateur normal doit obligatoirement
      // appartenir à un tenant et posséder un rôle.
      if (!req.user.tenantId || !req.user.roleId) {
        throw new AppError(
          403,
          "User role or tenant context is missing",
        );
      }

      // Vérifie que le rôle appartient bien au même tenant
      // que l'utilisateur authentifié et que la permission
      // demandée lui est associée.
      const rolePermission =
        await prisma.rolePermission.findFirst({
          where: {
            roleId: req.user.roleId,
            role: {
              tenantId: req.user.tenantId,
            },
            permission: {
              name: permissionName,
            },
          },
          select: {
            roleId: true,
          },
        });

      if (!rolePermission) {
        throw new AppError(
          403,
          "Forbidden: permission denied",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};