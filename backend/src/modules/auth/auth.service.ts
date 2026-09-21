import { prisma } from "../../config/prisma.js";
import {
  hashPassword,
  verifyPassword,
} from "../../services/password.service.js";
import type { AuthUser } from "../../types/auth.types.js";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../services/auth-token.service.js";

import { AppError } from "../../errors/app-error.js";
import type { RegisterInput } from "./auth.schema.js";

// Service centralisant les opérations d'authentification.
// La logique métier reste indépendante des contrôleurs HTTP.
export class AuthService {

  // Récupère le tenant utilisé par l'environnement de développement.
  // Cette méthode est temporaire et sera remplacée par un contexte
  // de tenant déterminé par l'authentification et les règles métier.
  async getDevelopmentTenant() {
    const tenant = await prisma.tenant.findUnique({
      where: {
        slug: "eduai-demo",
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) {
      throw new Error("Development tenant not found");
    }

    return tenant;
  }

  // Crée un utilisateur dans un tenant déterminé par le backend.
  async register(
    tenantId: string,
    input: RegisterInput,
  ) {
    // Vérifie que le rôle demandé appartient bien au tenant.
    const role = await prisma.role.findFirst({
      where: {
        tenantId,
        name: input.roleName,
      },
    });

    if (!role) {
      throw new Error("Role not found in this tenant");
    }

    // Vérifie que l'adresse email n'est pas déjà utilisée.
    const existingUser = await prisma.user.findUnique({
      where: {
        email: input.email,
      },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Le mot de passe n'est jamais stocké en clair.
    const passwordHash = await hashPassword(input.password);

    // Création du compte avec uniquement le hash du mot de passe.
    return prisma.user.create({
      data: {
        tenantId,
        roleId: role.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        isActive: true,
        emailVerified: false,
      },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  // Vérifie les identifiants d'un utilisateur existant.
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        systemRole: true,
        passwordHash: true,
        isActive: true,
      },
    });

    // Ne révèle pas si l'adresse email existe ou non.
    if (!user || !user.isActive) {
      return null;
    }

    const passwordValid = await verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      systemRole: user.systemRole,
    };
  }


    // Authentifie un utilisateur et génère son access token.
  async login(
    email: string,
    password: string,
  ) {
    const authUser = await this.validateCredentials(
      email,
      password,
    );

    // Utilise une réponse générique afin de ne pas révéler
    // si l'adresse email existe ou si seul le mot de passe est incorrect.
    if (!authUser) {
  throw new AppError(
    401,
    "Invalid email or password",
  );
}

    const accessToken = this.generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(authUser);

    return {
      accessToken,
      refreshToken,
      user: authUser,
    };
      }

  // Génère un access token à partir du contexte utilisateur authentifié.
  generateAccessToken(authUser: AuthUser): string {
    return generateAccessToken(authUser);
  }


    // Renouvelle l'access token à partir d'un refresh token valide.
  async refreshAccessToken(refreshToken: string) {
    const { userId } = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        systemRole: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("Authentication failed");
    }

    const authUser: AuthUser = {
      userId: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      systemRole: user.systemRole,
    };

    const accessToken = generateAccessToken(authUser);

    return {
      accessToken,
      user: authUser,
    };
  }
  
}