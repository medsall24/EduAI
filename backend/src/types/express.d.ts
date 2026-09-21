import type { AuthUser } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      // Utilisateur authentifié ajouté par le middleware JWT.
      user?: AuthUser;
    }
  }
}

export {};