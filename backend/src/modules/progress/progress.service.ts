import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type { UpdateProgressInput } from "./progress.schema.js";

/**
 * Service responsable de la gestion de la progression
 * des apprenants dans les formations.
 */
export class ProgressService {
  /**
   * Vérifie qu'un apprenant possède une inscription active
   * dans la formation concernée.
   *
   * Cette vérification est importante pour empêcher un utilisateur
   * d'enregistrer ou de consulter une progression sur une formation
   * à laquelle il n'est pas inscrit.
   *
   * Le tenantId est systématiquement utilisé afin de garantir
   * l'isolation des données entre les différents tenants.
   */
  private async getEnrollment(
    tenantId: string,
    userId: string,
    formationId: string,
  ) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        tenantId,
        userId,
        formationId,
        status: "ACTIVE",
      },
    });

    /**
     * Si aucune inscription active n'est trouvée,
     * l'utilisateur ne peut pas accéder à la progression
     * de cette formation.
     */
    if (!enrollment) {
      throw new AppError(
        403,
        "User is not actively enrolled in this formation",
      );
    }

    return enrollment;
  }

    /**
   * Met à jour la progression d'un apprenant pour une leçon.
   *
   * Avant toute modification, la méthode vérifie :
   * - que l'apprenant est inscrit à la formation ;
   * - que la leçon appartient bien au tenant ;
   * - que la leçon appartient à la formation concernée.
   *
   * La progression existante est mise à jour si elle existe.
   * Sinon, un nouvel enregistrement est créé.
   */
  async updateProgress(
    tenantId: string,
    userId: string,
    formationId: string,
    input: UpdateProgressInput,
  ) {
    /**
     * Vérifie que l'utilisateur possède une inscription
     * active dans la formation.
     */
    await this.getEnrollment(
      tenantId,
      userId,
      formationId,
    );

    /**
     * Vérifie que la leçon appartient bien à la formation
     * et au tenant courant.
     */
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: input.lessonId,
        tenantId,
        module: {
          formationId,
        },
      },
    });

    if (!lesson) {
      throw new AppError(
        404,
        "Lesson not found in this formation",
      );
    }

    /**
     * Recherche une progression existante pour cette leçon.
     *
     * La contrainte unique définie dans Prisma garantit
     * qu'un utilisateur ne possède qu'une seule progression
     * pour une même leçon dans un tenant.
     */
    const existingProgress =
      await prisma.progress.findFirst({
        where: {
          tenantId,
          userId,
          lessonId: input.lessonId,
        },
      });

    /**
     * Détermine la date de complétion.
     *
     * Elle est enregistrée uniquement lorsque la leçon
     * passe à l'état terminé.
     */
    const completedAt = input.isCompleted
      ? existingProgress?.completedAt ?? new Date()
      : null;

    /**
     * Mise à jour de la progression existante.
     */
    if (existingProgress) {
      return prisma.progress.update({
        where: {
          id: existingProgress.id,
        },
        data: {
          isCompleted: input.isCompleted,
          completedAt,
        },
      });
    }

    /**
     * Création d'une nouvelle progression lorsque
     * l'apprenant consulte cette leçon pour la première fois.
     */
    return prisma.progress.create({
      data: {
        tenantId,
        userId,
        formationId,
        lessonId: input.lessonId,
        isCompleted: input.isCompleted,
        completedAt,
      },
    });
  }

    /**
   * Récupère la progression globale d'un apprenant
   * pour une formation donnée.
   *
   * Le pourcentage est calculé à partir du nombre total
   * de leçons de la formation et du nombre de leçons terminées.
   */
  async getFormationProgress(
    tenantId: string,
    userId: string,
    formationId: string,
  ) {
    /**
     * Vérifie que l'utilisateur possède une inscription
     * active dans la formation.
     */
    await this.getEnrollment(
      tenantId,
      userId,
      formationId,
    );

    /**
     * Récupère toutes les leçons de la formation
     * appartenant au tenant courant.
     */
    const lessons = await prisma.lesson.findMany({
      where: {
        tenantId,
        module: {
          formationId,
        },
      },
      select: {
        id: true,
      },
    });

    /**
     * Compte le nombre de leçons terminées
     * par l'apprenant.
     */
    const completedLessons =
      await prisma.progress.count({
        where: {
          tenantId,
          userId,
          formationId,
          isCompleted: true,
          lessonId: {
            in: lessons.map((lesson) => lesson.id),
          },
        },
      });

    const totalLessons = lessons.length;

    /**
     * Évite une division par zéro lorsqu'une formation
     * ne contient encore aucune leçon.
     */
    const percentage =
      totalLessons === 0
        ? 0
        : Math.round(
            (completedLessons / totalLessons) * 100,
          );

    return {
      formationId,
      totalLessons,
      completedLessons,
      percentage,
    };
  }

    /**
   * Récupère la progression détaillée d'un apprenant
   * pour chaque leçon d'une formation.
   *
   * Cette méthode permet notamment au frontend de savoir
   * quelles leçons sont terminées et lesquelles restent à faire.
   */
  async getLessonProgress(
    tenantId: string,
    userId: string,
    formationId: string,
  ) {
    /**
     * Vérifie que l'utilisateur est bien inscrit
     * à la formation demandée.
     */
    await this.getEnrollment(
      tenantId,
      userId,
      formationId,
    );

    /**
     * Récupère les leçons de la formation ainsi que
     * la progression éventuelle de l'utilisateur.
     *
     * Les relations utilisent le tenantId afin de maintenir
     * l'isolation entre les tenants.
     */
    const lessons = await prisma.lesson.findMany({
      where: {
        tenantId,
        module: {
          formationId,
        },
      },
      orderBy: [
        {
          module: {
            position: "asc",
          },
        },
        {
          position: "asc",
        },
      ],
      select: {
        id: true,
        title: true,
        position: true,
        module: {
          select: {
            id: true,
            title: true,
            position: true,
          },
        },
        progress: {
          where: {
            tenantId,
            userId,
          },
          select: {
            isCompleted: true,
            completedAt: true,
          },
        },
      },
    });

    /**
     * Transforme les données afin de retourner une seule
     * progression par leçon.
     */
    return lessons.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      position: lesson.position,
      module: {
        id: lesson.module.id,
        title: lesson.module.title,
        position: lesson.module.position,
      },
      isCompleted:
        lesson.progress[0]?.isCompleted ?? false,
      completedAt:
        lesson.progress[0]?.completedAt ?? null,
    }));
  }
}