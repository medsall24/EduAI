import type { NextFunction, Request, Response } from "express";

import { ProgressService } from "./progress.service.js";
import { updateProgressSchema } from "./progress.schema.js";

/**
 * Contrôleur HTTP du module de gestion de la progression.
 *
 * Le contrôleur reçoit les requêtes HTTP, valide les données
 * entrantes et transmet les opérations au ProgressService.
 */
export class ProgressController {
  /**
   * Instance du service responsable de la logique métier
   * de la progression.
   */
  private readonly progressService = new ProgressService();

  /**
   * Met à jour la progression d'un apprenant sur une leçon.
   *
   * L'identité de l'utilisateur et son tenant sont récupérés
   * depuis le contexte d'authentification JWT.
   */
  async updateProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      /**
       * Vérifie que la requête possède un utilisateur authentifié.
       */
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      /**
       * Une progression appartient obligatoirement
       * à un tenant.
       */
      if (!req.user.tenantId) {
        res.status(403).json({
          success: false,
          message: "Tenant context is required",
        });
        return;
      }

      /**
       * Validation stricte des données reçues dans le body.
       */
      const input = updateProgressSchema.parse(req.body);

      /**
       * La formation est récupérée depuis les paramètres
       * de l'URL et non depuis le body.
       */
      const { formationId } = req.params;

if (typeof formationId !== "string" || !formationId) {
        res.status(400).json({
          success: false,
          message: "Formation ID is required",
        });
        return;
      }

      /**
       * Mise à jour de la progression.
       */
      const progress =
        await this.progressService.updateProgress(
          req.user.tenantId,
          req.user.userId,
          formationId,
          input,
        );

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      /**
       * Transmet l'erreur au middleware global de gestion
       * des erreurs.
       */
      next(error);
    }
  }

  /**
   * Récupère la progression globale d'un apprenant
   * pour une formation.
   */
  async getFormationProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      /**
       * Vérifie la présence du contexte d'authentification.
       */
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      /**
       * Vérifie la présence du tenant.
       */
      if (!req.user.tenantId) {
        res.status(403).json({
          success: false,
          message: "Tenant context is required",
        });
        return;
      }

      /**
       * Récupère l'identifiant de la formation
       * depuis les paramètres de l'URL.
       */
      const { formationId } = req.params;

if (typeof formationId !== "string" || !formationId) {
        res.status(400).json({
          success: false,
          message: "Formation ID is required",
        });
        return;
      }

      /**
       * Récupère la progression calculée par le service.
       */
      const progress =
        await this.progressService.getFormationProgress(
          req.user.tenantId,
          req.user.userId,
          formationId,
        );

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      /**
       * Transmet l'erreur au middleware global.
       */
      next(error);
    }
  }

  /**
   * Récupère le détail de progression leçon par leçon
   * pour une formation.
   */
  async getLessonProgress(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      /**
       * Vérifie la présence du contexte d'authentification.
       */
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      /**
       * Vérifie la présence du tenant.
       */
      if (!req.user.tenantId) {
        res.status(403).json({
          success: false,
          message: "Tenant context is required",
        });
        return;
      }

      /**
       * Récupère l'identifiant de la formation
       * depuis les paramètres de l'URL.
       */
      const { formationId } = req.params;

if (typeof formationId !== "string" || !formationId) {
        res.status(400).json({
          success: false,
          message: "Formation ID is required",
        });
        return;
      }

      /**
       * Récupère le détail de la progression
       * depuis le service métier.
       */
      const progress =
        await this.progressService.getLessonProgress(
          req.user.tenantId,
          req.user.userId,
          formationId,
        );

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      /**
       * Transmet l'erreur au middleware global.
       */
      next(error);
    }
  }
}