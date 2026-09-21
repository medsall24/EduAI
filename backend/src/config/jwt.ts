// Charge les variables définies dans le fichier .env.
import "dotenv/config";

// Vérifie qu'une variable d'environnement obligatoire existe.
const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

// Configuration centralisée utilisée pour la génération
// et la vérification des JWT.
export const jwtConfig = {
  // Secret utilisé pour signer et vérifier les access tokens.
  accessSecret: requireEnv("JWT_ACCESS_SECRET"),

  // Durée de validité de l'access token.
  accessExpiresIn: process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m",

  // Secret distinct utilisé pour les refresh tokens.
  refreshSecret: requireEnv("JWT_REFRESH_SECRET"),

  // Durée de validité du refresh token.
  refreshExpiresIn: process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d",
};