
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  updateUserStatusSchema,
  userIdSchema,
} from "./user.schema.js";
import { UserService } from "./user.service.js";

export class UserController {
  private readonly userService = new UserService();

  /**
   * Crée un utilisateur dans le tenant courant.
   */
  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const parsed = createUserSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new AppError(400, "Invalid user data");
      }

      const user = await this.userService.create(
        tenantId,
        parsed.data,
      );

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Liste les utilisateurs du tenant avec pagination.
   */
  async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const parsed = listUsersQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new AppError(400, "Invalid query parameters");
      }

      const result = await this.userService.findAll(
        tenantId,
        parsed.data,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consulte un utilisateur du tenant courant.
   */
  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const parsed = userIdSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new AppError(400, "Invalid user ID");
      }

      const user = await this.userService.findById(
        tenantId,
        parsed.data.id,
      );

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Modifie les informations autorisées d'un utilisateur.
   */
  async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const idParsed = userIdSchema.safeParse(req.params);

      if (!idParsed.success) {
        throw new AppError(400, "Invalid user ID");
      }

      const bodyParsed = updateUserSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new AppError(400, "Invalid user data");
      }

      const user = await this.userService.update(
        tenantId,
        idParsed.data.id,
        bodyParsed.data,
      );

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active ou désactive un compte utilisateur.
   */
  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const idParsed = userIdSchema.safeParse(req.params);

      if (!idParsed.success) {
        throw new AppError(400, "Invalid user ID");
      }

      const bodyParsed =
        updateUserStatusSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new AppError(400, "Invalid status data");
      }

      const user = await this.userService.updateStatus(
        tenantId,
        idParsed.data.id,
        bodyParsed.data,
      );

      res.status(200).json({
        success: true,
        message: "User status updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprime un utilisateur du tenant courant.
   */
  async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(403, "Tenant context is required");
      }

      const parsed = userIdSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new AppError(400, "Invalid user ID");
      }

      const result = await this.userService.delete(
        tenantId,
        parsed.data.id,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
