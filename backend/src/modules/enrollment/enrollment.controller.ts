import type { NextFunction, Request, Response } from "express";

import { EnrollmentService } from "./enrollment.service.js";
import { createEnrollmentSchema } from "./enrollment.schema.js";

// Contrôleur chargé de recevoir les requêtes HTTP liées aux inscriptions.
export class EnrollmentController {
  private readonly enrollmentService = new EnrollmentService();

  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Le tenantId provient du contexte JWT et ne doit jamais être fourni
      // par le client afin d'éviter les accès inter-tenant.
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        res.status(403).json({
          success: false,
          message: "Tenant context is required",
        });
        return;
      }

      // Validation des données reçues avant tout traitement métier.
      const input = createEnrollmentSchema.parse(req.body);

      const enrollment =
        await this.enrollmentService.createEnrollment(
          tenantId,
          input.userId,
          input.formationId,
        );

      res.status(201).json({
        success: true,
        data: enrollment,
      });
    } catch (error) {
      next(error);
    }
  }
}