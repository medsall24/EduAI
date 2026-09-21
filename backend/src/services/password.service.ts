import argon2 from "argon2";

// Service centralisé responsable du hachage et de la vérification
// des mots de passe utilisateurs avec Argon2id.
export const hashPassword = async (
  password: string,
): Promise<string> => {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
};

// Vérifie un mot de passe en le comparant à son hash Argon2id.
// Le mot de passe original n'est jamais stocké en base de données.
export const verifyPassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  return argon2.verify(passwordHash, password);
};