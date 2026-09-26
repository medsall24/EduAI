import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  createModuleSchema,
  formationIdSchema,
  moduleIdSchema,
  updateModuleSchema,
} from "./module.schema.js";
import {
  createModule,
  deleteModule,
  getModuleById,
  listModules,
  updateModule,
} from "./module.service.js";

export const createModuleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed =
      createModuleSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid module data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const module = await createModule(
      req.user?.tenantId ?? null,
      parsed.data,
    );

    res.status(201).json({
      success: true,
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export const listModulesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed =
      formationIdSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid formation ID",
      });
      return;
    }

    const modules = await listModules(
      req.user?.tenantId ?? null,
      parsed.data.formationId,
    );

    res.status(200).json({
      success: true,
      data: modules,
    });
  } catch (error) {
    next(error);
  }
};

export const getModuleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed =
      moduleIdSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid module ID",
      });
      return;
    }

    const module = await getModuleById(
      req.user?.tenantId ?? null,
      parsed.data.id,
    );

    res.status(200).json({
      success: true,
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export const updateModuleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const params =
      moduleIdSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        success: false,
        message: "Invalid module ID",
      });
      return;
    }

    const body =
      updateModuleSchema.safeParse(req.body);

    if (!body.success) {
      res.status(400).json({
        success: false,
        message: "Invalid module data",
        errors: body.error.flatten(),
      });
      return;
    }

    const module = await updateModule(
      req.user?.tenantId ?? null,
      params.data.id,
      body.data,
    );

    res.status(200).json({
      success: true,
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteModuleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed =
      moduleIdSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid module ID",
      });
      return;
    }

    await deleteModule(
      req.user?.tenantId ?? null,
      parsed.data.id,
    );

    res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};