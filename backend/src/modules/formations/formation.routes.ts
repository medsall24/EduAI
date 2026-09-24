import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import {
  createFormationController,
  deleteFormationController,
  getFormationController,
  listFormationsController,
  updateFormationController,
} from "./formation.controller.js";

const router = Router();

router.get(
  "/",
  authenticate,
  requirePermission("formation.read"),
  listFormationsController,
);

router.get(
  "/:id",
  authenticate,
  requirePermission("formation.read"),
  getFormationController,
);

router.post(
  "/",
  authenticate,
  requirePermission("formation.create"),
  createFormationController,
);

router.patch(
  "/:id",
  authenticate,
  requirePermission("formation.update"),
  updateFormationController,
);

router.delete(
  "/:id",
  authenticate,
  requirePermission("formation.delete"),
  deleteFormationController,
);

export default router;