import jwt, { type SignOptions } from "jsonwebtoken";

import { jwtConfig } from "../config/jwt.js";
import type { AuthUser } from "../types/auth.types.js";

// Génère un access token contenant le contexte nécessaire
// à l'authentification et à l'isolation du tenant.
export const generateAccessToken = (
  authUser: AuthUser,
): string => {
  const payload = {
    userId: authUser.userId,
    tenantId: authUser.tenantId,
    roleId: authUser.roleId,
    systemRole: authUser.systemRole,
  };

  const options: SignOptions = {
    expiresIn:
      jwtConfig.accessExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    jwtConfig.accessSecret,
    options,
  );
};

// Génère un refresh token séparé de l'access token.
// Le refresh token possède sa propre clé secrète et une durée de vie plus longue.
export const generateRefreshToken = (
  authUser: AuthUser,
): string => {
  const payload = {
    userId: authUser.userId,
  };

  const options: SignOptions = {
    expiresIn:
      jwtConfig.refreshExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    payload,
    jwtConfig.refreshSecret,
    options,
  );
};


// Vérifie un refresh token avec sa clé secrète dédiée
// et retourne uniquement l'identifiant de l'utilisateur.
export const verifyRefreshToken = (
  refreshToken: string,
): { userId: string } => {
  const payload = jwt.verify(
    refreshToken,
    jwtConfig.refreshSecret,
  );

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }

  return {
    userId: payload.userId,
  };
};