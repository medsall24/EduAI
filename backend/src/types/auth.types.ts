// Contexte de l'utilisateur authentifié transmis par le middleware JWT.
export interface AuthUser {
  // Identifiant unique de l'utilisateur.
  userId: string;

  // Identifiant du tenant auquel l'utilisateur appartient.
  // Il est null uniquement pour le SUPER_ADMIN.
  tenantId: string | null;

  // Identifiant du rôle applicatif de l'utilisateur.
  // Le SUPER_ADMIN n'a pas de rôle tenant.
  roleId: string | null;

  // Rôle système global éventuel.
  systemRole: "SUPER_ADMIN" | null;
}