import { describe, expect, it } from "vitest";
import { registerSchema } from "../src/modules/auth/auth.schema.js";

const donneesInscription = {
  firstName: "Test",
  lastName: "Utilisateur",
  email: "TEST@example.com",
  password: "MotDePasse123",
};

describe("registerSchema", () => {
  it("accepte une inscription avec le rôle APPRENANT", () => {
    const resultat = registerSchema.safeParse({
      ...donneesInscription,
      roleName: "APPRENANT",
    });

    expect(resultat.success).toBe(true);

    if (resultat.success) {
      expect(resultat.data.roleName).toBe("APPRENANT");
      expect(resultat.data.email).toBe("test@example.com");
    }
  });

  it("refuse une inscription publique avec le rôle FORMATEUR", () => {
    const resultat = registerSchema.safeParse({
      ...donneesInscription,
      roleName: "FORMATEUR",
    });

    expect(resultat.success).toBe(false);
  });

  it("refuse une inscription publique avec le rôle TENANT_ADMIN", () => {
    const resultat = registerSchema.safeParse({
      ...donneesInscription,
      roleName: "TENANT_ADMIN",
    });

    expect(resultat.success).toBe(false);
  });
});
