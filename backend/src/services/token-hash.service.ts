import { createHash } from "node:crypto";

// Produit une empreinte déterministe du refresh token.
// Le token original n'est jamais stocké en base de données.
export const hashRefreshToken = (
  refreshToken: string,
): string => {
  return createHash("sha256")
    .update(refreshToken, "utf8")
    .digest("hex");
};