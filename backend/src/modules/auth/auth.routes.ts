import { Router } from "express";

import { AuthController } from "./auth.controller.js";

// Routes HTTP du module d'authentification.
const router = Router();

const authController = new AuthController();

// Création d'un compte utilisateur.
router.post(
  "/register",
  authController.register.bind(authController),
);

// Authentification d'un utilisateur existant.
router.post(
  "/login",
  authController.login.bind(authController),
);

// Renouvellement d'un access token avec un refresh token valide.
router.post(
  "/refresh",
  authController.refresh.bind(authController),
);



export default router;