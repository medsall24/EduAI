import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Configuration de l'adaptateur PostgreSQL utilisé par Prisma.
const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
});

// Initialisation du client Prisma avec l'adaptateur PostgreSQL.
const prisma = new PrismaClient({
  adapter,
});

// Liste centralisée des permissions disponibles dans le système RBAC.
const permissions = [
  // Permissions de gestion des utilisateurs.
  {
    name: "user.read",
    description: "Consulter les utilisateurs",
  },
  {
    name: "user.create",
    description: "Créer un utilisateur",
  },
  {
    name: "user.update",
    description: "Modifier un utilisateur",
  },
  {
    name: "user.delete",
    description: "Supprimer un utilisateur",
  },

  // Permissions de gestion des formations.
  {
    name: "formation.read",
    description: "Consulter les formations",
  },
  {
    name: "formation.create",
    description: "Créer une formation",
  },
  {
    name: "formation.update",
    description: "Modifier une formation",
  },
  {
    name: "formation.delete",
    description: "Supprimer une formation",
  },

  // Permissions de gestion des catégories.
  {
    name: "category.read",
    description: "Consulter les catégories",
  },
  {
    name: "category.create",
    description: "Créer une catégorie",
  },
  {
    name: "category.update",
    description: "Modifier une catégorie",
  },
  {
    name: "category.delete",
    description: "Supprimer une catégorie",
  },

  // Permissions de gestion des modules.
  {
    name: "module.read",
    description: "Consulter les modules",
  },
  {
    name: "module.create",
    description: "Créer un module",
  },
  {
    name: "module.update",
    description: "Modifier un module",
  },
  {
    name: "module.delete",
    description: "Supprimer un module",
  },

  // Permissions de gestion des leçons.
  {
    name: "lesson.read",
    description: "Consulter les leçons",
  },
  {
    name: "lesson.create",
    description: "Créer une leçon",
  },
  {
    name: "lesson.update",
    description: "Modifier une leçon",
  },
  {
    name: "lesson.delete",
    description: "Supprimer une leçon",
  },

  // Permissions de gestion des ressources.
  {
    name: "resource.read",
    description: "Consulter les ressources",
  },
  {
    name: "resource.create",
    description: "Créer une ressource",
  },
  {
    name: "resource.update",
    description: "Modifier une ressource",
  },
  {
    name: "resource.delete",
    description: "Supprimer une ressource",
  },

  // Permissions de gestion des inscriptions.
  {
    name: "enrollment.read",
    description: "Consulter les inscriptions",
  },
  {
    name: "enrollment.create",
    description: "Créer une inscription",
  },
  {
    name: "enrollment.update",
    description: "Modifier une inscription",
  },
  {
    name: "enrollment.delete",
    description: "Supprimer une inscription",
  },
];

// Fonction principale de synchronisation des permissions RBAC.
const main = async (): Promise<void> => {
  // Création ou mise à jour de chaque permission.
  // L'upsert permet de réexécuter le seed sans créer de doublons.
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }

  // Association des permissions avec les rôles applicatifs.
  // Les permissions sont définies une seule fois puis appliquées
  // à chaque rôle correspondant dans tous les tenants.
  const rolePermissions: Record<string, string[]> = {
    // Le TENANT_ADMIN dispose de toutes les permissions disponibles.
    TENANT_ADMIN: permissions.map(
      (permission) => permission.name,
    ),

    // Le FORMATEUR peut gérer les formations,
    // modules, leçons et ressources.
    // Il peut également consulter les catégories et les inscriptions.
    FORMATEUR: [
      "formation.read",
      "formation.create",
      "formation.update",
      "formation.delete",

      "category.read",

      "module.read",
      "module.create",
      "module.update",
      "module.delete",

      "lesson.read",
      "lesson.create",
      "lesson.update",
      "lesson.delete",

      "resource.read",
      "resource.create",
      "resource.update",
      "resource.delete",

      "enrollment.read",
    ],

    // L'APPRENANT dispose de permissions de consultation
    // et peut créer sa propre inscription.
    APPRENANT: [
      "formation.read",

      "category.read",

      "module.read",
      "lesson.read",
      "resource.read",

      "enrollment.read",
      "enrollment.create",
    ],
  };

  // Parcours de chaque type de rôle afin de synchroniser
  // les permissions sur tous les tenants.
  for (const [roleName, permissionNames] of Object.entries(
    rolePermissions,
  )) {
    // Récupération de tous les rôles portant ce nom.
    // Cette étape est essentielle dans une architecture multi-tenant :
    // chaque tenant possède sa propre instance du rôle.
    const roles = await prisma.role.findMany({
      where: {
        name: roleName,
      },
    });

    // Le seed ne peut pas continuer si aucun rôle attendu n'existe.
    if (roles.length === 0) {
      throw new Error(
        `No role found for role name: ${roleName}`,
      );
    }

    // Synchronisation des permissions pour chaque rôle
    // appartenant aux différents tenants.
    for (const role of roles) {
      // Association de chaque permission au rôle courant.
      for (const permissionName of permissionNames) {
        const permission =
          await prisma.permission.findUnique({
            where: {
              name: permissionName,
            },
          });

        // Vérification de l'existence de la permission
        // avant la création de l'association.
        if (!permission) {
          throw new Error(
            `Permission not found: ${permissionName}`,
          );
        }

        // Création de l'association si elle n'existe pas déjà.
        // L'upsert garantit l'idempotence du seed.
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  // Confirmation de la synchronisation des permissions.
  console.log(
    `${permissions.length} permissions RBAC synchronisées pour tous les rôles concernés.`,
  );
};

// Exécution du seed avec gestion centralisée des erreurs.
main()
  .catch((error) => {
    console.error(
      "Erreur lors du seed RBAC :",
      error,
    );
    process.exit(1);
  })
  .finally(async () => {
    // Fermeture propre de la connexion Prisma.
    await prisma.$disconnect();
  });