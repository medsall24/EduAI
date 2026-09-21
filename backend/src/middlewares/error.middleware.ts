import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

// Middleware centralisé de gestion des erreurs de l'API.
// Il empêche notamment l'exposition des stack traces au client.
export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {

      // Les erreurs applicatives contrôlées utilisent directement
  // le code HTTP défini par le service métier.
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }
  
  // Les erreurs JWT invalides ou expirées correspondent
  // à une authentification non valide.
  if (
  error instanceof jwt.JsonWebTokenError ||
  error instanceof jwt.TokenExpiredError
) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
    return;
  }

  // Les erreurs de validation Zod correspondent à une
  // requête client incorrecte.
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues,
    });
    return;
  }

  // Les erreurs non prévues ne doivent jamais exposer
  // leur stack trace ou leurs détails internes.
  console.error(error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};