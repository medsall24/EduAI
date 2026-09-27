import { Request, Response, NextFunction } from "express";
import {
  createLessonSchema,
  updateLessonSchema,
  lessonIdSchema,
  moduleIdSchema,
} from "./lesson.schema.js";
import {
  createLesson,
  listLessons,
  getLesson,
  updateLesson,
  deleteLesson,
} from "./lesson.service.js";

/**
 * Crée une nouvelle leçon.
 */
export async function createLessonController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation des données reçues dans le body.
    const validation = createLessonSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson data",
        errors: validation.error.flatten(),
      });
    }

    // Le tenantId provient de l'utilisateur authentifié.
    const tenantId = req.user?.tenantId ?? null;

    const lesson = await createLesson(
      { tenantId },
      validation.data,
    );

    return res.status(201).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne toutes les leçons d'un module.
 */
export async function listLessonsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant du module.
    const validation = moduleIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID",
        errors: validation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    const lessons = await listLessons(
      { tenantId },
      validation.data.moduleId,
    );

    return res.status(200).json({
      success: true,
      data: lessons,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne une leçon par son identifiant.
 */
export async function getLessonController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant de la leçon.
    const validation = lessonIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
        errors: validation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    const lesson = await getLesson(
      { tenantId },
      validation.data.id,
    );

    return res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Modifie une leçon existante.
 */
export async function updateLessonController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant de la leçon.
    const idValidation = lessonIdSchema.safeParse(req.params);

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
        errors: idValidation.error.flatten(),
      });
    }

    // Validation des données à modifier.
    const bodyValidation = updateLessonSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    const lesson = await updateLesson(
      { tenantId },
      idValidation.data.id,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une leçon.
 */
export async function deleteLessonController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Validation de l'identifiant de la leçon.
    const validation = lessonIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson ID",
        errors: validation.error.flatten(),
      });
    }

    const tenantId = req.user?.tenantId ?? null;

    await deleteLesson(
      { tenantId },
      validation.data.id,
    );

    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
