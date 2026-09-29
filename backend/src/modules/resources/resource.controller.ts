import { Request, Response } from "express";
import {
  createResource,
  listResourcesByLesson,
  getResourceById,
  updateResource,
  deleteResource,
} from "./resource.service.js";
import {
  createResourceSchema,
  updateResourceSchema,
  resourceIdSchema,
  lessonIdSchema,
} from "./resource.schema.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Récupère le contexte du tenant depuis l'utilisateur authentifié.
 *
 * Les routes Resource sont protégées par le middleware authenticate.
 * Cette vérification supplémentaire permet également à TypeScript
 * de savoir que req.user existe avant son utilisation.
 */
const getTenantContext = (req: Request) => {
  if (!req.user) {
    throw new AppError(
      401,
      "Authentication required",
    );
  }

  return {
    tenantId: req.user.tenantId,
  };
};

/**
 * Création d'une ressource.
 *
 * POST /api/resources
 */
export const createResourceController = async (
  req: Request,
  res: Response,
) => {
  // Validation du corps de la requête avec Zod.
  const data = createResourceSchema.parse(req.body);

  // Récupération du contexte du tenant connecté.
  const context = getTenantContext(req);

  // Création de la ressource.
  const resource = await createResource(
    data,
    context,
  );

  return res.status(201).json({
    success: true,
    data: resource,
  });
};

/**
 * Liste les ressources d'une leçon.
 *
 * GET /api/lessons/:lessonId/resources
 */
export const listResourcesController = async (
  req: Request,
  res: Response,
) => {
  // Validation de l'identifiant de la leçon.
  const { lessonId } = lessonIdSchema.parse({
    lessonId: req.params.lessonId,
  });

  // Récupération du contexte du tenant connecté.
  const context = getTenantContext(req);

  // Récupération des ressources de la leçon.
  const resources = await listResourcesByLesson(
    lessonId,
    context,
  );

  return res.status(200).json({
    success: true,
    data: resources,
  });
};

/**
 * Récupère une ressource précise.
 *
 * GET /api/resources/:id
 */
export const getResourceController = async (
  req: Request,
  res: Response,
) => {
  // Validation de l'identifiant de la ressource.
  const { id } = resourceIdSchema.parse({
    id: req.params.id,
  });

  // Récupération du contexte du tenant connecté.
  const context = getTenantContext(req);

  // Recherche de la ressource.
  const resource = await getResourceById(
    id,
    context,
  );

  return res.status(200).json({
    success: true,
    data: resource,
  });
};

/**
 * Modification d'une ressource.
 *
 * PATCH /api/resources/:id
 */
export const updateResourceController = async (
  req: Request,
  res: Response,
) => {
  // Validation de l'identifiant de la ressource.
  const { id } = resourceIdSchema.parse({
    id: req.params.id,
  });

  // Validation des données envoyées.
  const data = updateResourceSchema.parse(req.body);

  // Récupération du contexte du tenant connecté.
  const context = getTenantContext(req);

  // Mise à jour de la ressource.
  const resource = await updateResource(
    id,
    data,
    context,
  );

  return res.status(200).json({
    success: true,
    data: resource,
  });
};

/**
 * Suppression d'une ressource.
 *
 * DELETE /api/resources/:id
 */
export const deleteResourceController = async (
  req: Request,
  res: Response,
) => {
  // Validation de l'identifiant de la ressource.
  const { id } = resourceIdSchema.parse({
    id: req.params.id,
  });

  // Récupération du contexte du tenant connecté.
  const context = getTenantContext(req);

  // Suppression de la ressource.
  const result = await deleteResource(
    id,
    context,
  );

  return res.status(200).json({
    success: true,
    data: result,
  });
};