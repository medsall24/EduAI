import type { NextFunction, Request, Response } from "express";

import { AuthService } from "./auth.service.js";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "./auth.schema.js";

// Contrôleur HTTP du module d'authentification.
export class AuthController {
  private readonly authService = new AuthService();

  async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Validation stricte des données reçues du client.
      const input = registerSchema.parse(req.body);

      // Pour le premier environnement de développement,
      // le tenant de test est résolu côté backend.
      const tenant = await this.authService.getDevelopmentTenant();

      const user = await this.authService.register(
        tenant.id,
        input,
      );

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

    async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Validation stricte des identifiants reçus.
      const input = loginSchema.parse(req.body);

      // Authentification et génération de l'access token.
      const result = await this.authService.login(
        input.email,
        input.password,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

    // Renouvelle l'access token à partir d'un refresh token valide.
  async refresh(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Validation stricte du refresh token reçu.
      const input = refreshTokenSchema.parse(req.body);

      // Vérification du refresh token et génération
      // d'un nouvel access token.
      const result =
        await this.authService.refreshAccessToken(
          input.refreshToken,
        );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

    async logout(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = refreshTokenSchema.parse(req.body);

      await this.authService.logout(input.refreshToken);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  
}