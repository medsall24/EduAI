import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"],
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
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

const main = async (): Promise<void> => {
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

  const rolePermissions: Record<string, string[]> = {
  TENANT_ADMIN: permissions.map(
    (permission) => permission.name,
  ),

  FORMATEUR: [
    "formation.read",
    "formation.create",
    "formation.update",
    "formation.delete",

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

  APPRENANT: [
    "formation.read",
    "module.read",
    "lesson.read",
    "resource.read",

    "enrollment.read",
    "enrollment.create",
  ],
};

for (const [roleName, permissionNames] of Object.entries(
  rolePermissions,
)) {
  const role = await prisma.role.findFirst({
    where: {
      name: roleName,
    },
  });

  if (!role) {
    throw new Error(
      `Role not found: ${roleName}`,
    );
  }

  for (const permissionName of permissionNames) {
    const permission = await prisma.permission.findUnique({
      where: {
        name: permissionName,
      },
    });

    if (!permission) {
      throw new Error(
        `Permission not found: ${permissionName}`,
      );
    }

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
  console.log(
    `${permissions.length} permissions RBAC synchronisées.`,
  );
};

main()
  .catch((error) => {
    console.error("Erreur lors du seed RBAC :", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });