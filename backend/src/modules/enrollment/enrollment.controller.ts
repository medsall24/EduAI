import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  createEnrollmentSchema,
  enrollmentIdSchema,
  updateEnrollmentSchema,
} from "./enrollment.schema.js";
import { EnrollmentService } from "./enrollment.service.js";

export class EnrollmentController {
  private readonly enrollmentService =
    new EnrollmentService();

  /**
   * Crée une inscription.
   *
   * Le service vérifie notamment qu'un APPRENANT
   * ne peut inscrire que son propre compte.
   */
  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const roleId = req.user?.roleId;

      if (!tenantId || !userId || !roleId) {
        throw new AppError(
          403,
          "Tenant and user context are required",
        );
      }

      const parsed =
        createEnrollmentSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new AppError(
          400,
          "Invalid enrollment data",
        );
      }

      const enrollment =
        await this.enrollmentService.createEnrollment(
          tenantId,
          userId,
          roleId,
          parsed.data,
        );

      res.status(201).json({
        success: true,
        message: "Enrollment created successfully",
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Liste les inscriptions visibles par l'utilisateur.
   *
   * Un APPRENANT ne reçoit que ses propres inscriptions.
   */
  async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const roleId = req.user?.roleId;

      if (!tenantId || !userId || !roleId) {
        throw new AppError(
          403,
          "Tenant and user context are required",
        );
      }

      const enrollments =
        await this.enrollmentService.listEnrollments(
          tenantId,
          userId,
          roleId,
        );

      res.status(200).json({
        success: true,
        data: enrollments,
      });
    } catch (error) {
      next(error);
    }
  }

    /**
   * Consulte une inscription.
   *
   * Le service applique également la règle métier :
   * un APPRENANT ne peut consulter que ses propres inscriptions.
   */
  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;
      const roleId = req.user?.roleId;

      if (!tenantId || !userId || !roleId) {
        throw new AppError(
          403,
          "Tenant and user context are required",
        );
      }

      const parsed =
        enrollmentIdSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new AppError(
          400,
          "Invalid enrollment ID",
        );
      }

      const enrollment =
        await this.enrollmentService.getEnrollmentById(
          tenantId,
          userId,
          roleId,
          parsed.data.id,
        );

      res.status(200).json({
        success: true,
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Modifie le statut d'une inscription.
   */
  async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(
          403,
          "Tenant context is required",
        );
      }

      const idParsed =
        enrollmentIdSchema.safeParse(req.params);

      if (!idParsed.success) {
        throw new AppError(
          400,
          "Invalid enrollment ID",
        );
      }

      const bodyParsed =
        updateEnrollmentSchema.safeParse(req.body);

      if (!bodyParsed.success) {
        throw new AppError(
          400,
          "Invalid enrollment data",
        );
      }

      const enrollment =
        await this.enrollmentService.updateEnrollment(
          tenantId,
          idParsed.data.id,
          bodyParsed.data,
        );

      res.status(200).json({
        success: true,
        message: "Enrollment updated successfully",
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprime une inscription.
   */
  async delete(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError(
          403,
          "Tenant context is required",
        );
      }

      const parsed =
        enrollmentIdSchema.safeParse(req.params);

      if (!parsed.success) {
        throw new AppError(
          400,
          "Invalid enrollment ID",
        );
      }

      await this.enrollmentService.deleteEnrollment(
        tenantId,
        parsed.data.id,
      );

      res.status(200).json({
        success: true,
        data: {
          message: "Enrollment deleted successfully",
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
