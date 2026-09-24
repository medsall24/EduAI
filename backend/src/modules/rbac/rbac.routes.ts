import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const router = Router();

router.get(
  "/test/formation-read",
  authenticate,
  requirePermission("formation.read"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Permission formation.read granted",
    });
  },
);

router.get(
  "/test/formation-create",
  authenticate,
  requirePermission("formation.create"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Permission formation.create granted",
    });
  },
);

export default router;