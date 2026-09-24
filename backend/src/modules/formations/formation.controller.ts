import type { Request, Response } from "express";

import { AppError } from "../../errors/app-error.js";
import {
  createFormationSchema,
  formationIdSchema,
  updateFormationSchema,
} from "./formation.schema.js";
import {
  createFormation,
  deleteFormation,
  getFormationById,
  listFormations,
  updateFormation,
} from "./formation.service.js";

export const createFormationController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = createFormationSchema.safeParse(
    req.body,
  );

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid formation data",
    );
  }

  const formation = await createFormation(
    req.user?.tenantId ?? null,
    parsed.data,
  );

  res.status(201).json({
    success: true,
    message: "Formation created successfully",
    data: formation,
  });
};

export const listFormationsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const formations = await listFormations(
    req.user?.tenantId ?? null,
  );

  res.status(200).json({
    success: true,
    data: formations,
  });
};

export const getFormationController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = formationIdSchema.safeParse(
    req.params,
  );

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid formation ID",
    );
  }

  const formation = await getFormationById(
    req.user?.tenantId ?? null,
    parsed.data.id,
  );

  res.status(200).json({
    success: true,
    data: formation,
  });
};

export const updateFormationController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const idParsed = formationIdSchema.safeParse(
    req.params,
  );

  if (!idParsed.success) {
    throw new AppError(
      400,
      "Invalid formation ID",
    );
  }

  const bodyParsed =
    updateFormationSchema.safeParse(req.body);

  if (!bodyParsed.success) {
    throw new AppError(
      400,
      "Invalid formation data",
    );
  }

  const formation = await updateFormation(
    req.user?.tenantId ?? null,
    idParsed.data.id,
    bodyParsed.data,
  );

  res.status(200).json({
    success: true,
    message: "Formation updated successfully",
    data: formation,
  });
};

export const deleteFormationController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = formationIdSchema.safeParse(
    req.params,
  );

  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid formation ID",
    );
  }

  await deleteFormation(
    req.user?.tenantId ?? null,
    parsed.data.id,
  );

  res.status(200).json({
    success: true,
    message: "Formation deleted successfully",
  });
};