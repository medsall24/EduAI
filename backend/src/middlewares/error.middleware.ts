
import { Prisma } from "../generated/prisma/client.js";
import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";

// Décrit les erreurs produites par le parseur JSON
// sans dépendre d'un type interne de body-parser.
type HttpParserError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
};

// Gère centralement les erreurs de l'API sans divulguer
// les stack traces ni les détails internes au client.
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  // Les erreurs métier contrôlées conservent leur statut HTTP.
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

  // Les erreurs de validation Zod correspondent
  // à une requête client incorrecte.
  if (error instanceof ZodError) {
  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    })),
  });
  return;
}

  // Reconnaît les erreurs générées par le parseur JSON d'Express.
  if (error instanceof Error) {
    const parserError = error as HttpParserError;

    // Un corps JSON trop volumineux doit produire HTTP 413.
    if (parserError.type === "entity.too.large") {
      res.status(413).json({
        success: false,
        message: "Request body too large",
      });
      return;
    }

    // Un JSON mal formé doit produire HTTP 400.
    if (parserError.type === "entity.parse.failed") {
      res.status(400).json({
        success: false,
        message: "Invalid JSON body",
      });
      return;
    }

    // Traite les erreurs de taille de requête connues.
    if (
      parserError.status === 400 &&
      parserError.type === "request.size.invalid"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
      });
      return;
    }
  }

  // Traite les erreurs Prisma connues avant toute réponse générique.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        res.status(409).json({
          success: false,
          message: "A resource with these details already exists",
        });
        return;

      case "P2003":
        res.status(409).json({
          success: false,
          message: "The operation conflicts with an existing resource",
        });
        return;

      case "P2025":
        res.status(404).json({
          success: false,
          message: "Resource not found",
        });
        return;

      default:
        break;
    }
  }

  // Journalise les erreurs inattendues côté serveur uniquement.
  console.error(error);

  // Ne divulgue jamais la stack trace ni les détails internes.
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
