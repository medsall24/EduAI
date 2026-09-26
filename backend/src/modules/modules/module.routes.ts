import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

import {
  createModuleController,
  deleteModuleController,
  getModuleController,
  listModulesController,
  updateModuleController,
} from "./module.controller.js";

const router = Router();

router.get(
  "/formations/:formationId/modules",
  authenticate,
  requirePermission("module.read"),
  listModulesController,
);

router.post(
  "/modules",
  authenticate,
  requirePermission("module.create"),
  createModuleController,
);

router.get(
  "/modules/:id",
  authenticate,
  requirePermission("module.read"),
  getModuleController,
);

router.patch(
  "/modules/:id",
  authenticate,
  requirePermission("module.update"),
  updateModuleController,
);

router.delete(
  "/modules/:id",
  authenticate,
  requirePermission("module.delete"),
  deleteModuleController,
);

export default router;