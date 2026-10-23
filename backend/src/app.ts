
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./modules/auth/auth.routes.js";
import enrollmentRoutes from "./modules/enrollment/enrollment.routes.js";
import rbacRoutes from "./modules/rbac/rbac.routes.js";
import formationRoutes from "./modules/formations/formation.routes.js";
import moduleRoutes from "./modules/modules/module.routes.js";
import lessonRoutes from "./modules/lessons/lesson.routes.js";
import resourceRoutes from "./modules/resources/resource.routes.js";
import categoryRoutes from "./modules/categories/category.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import progressRoutes from "./modules/progress/progress.routes.js";
import quizRoutes from "./modules/quizzes/quiz.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// Sécurité des en-têtes HTTP.
app.use(helmet());

// CORS : les origines seront configurées via CORS_ORIGINS.
// Sans Origin, les clients non-navigateurs (ex. Postman) restent utilisables.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

     callback(null, false);    },
    credentials: true,
  }),
);

// Limitation de la taille des corps JSON.
app.use(express.json({ limit: "1mb" }));

// Limitation générale du nombre de requêtes.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

// Route de santé.
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "EduAI Backend API is running",
  });
});

// Routes d'authentification.
app.use("/api/auth", authRoutes);

// Routes de gestion des utilisateurs.
app.use("/api/users", userRoutes);

// Routes liées aux inscriptions aux formations.
app.use("/api/enrollments", enrollmentRoutes);

// Routes RBAC.
app.use("/api/rbac", rbacRoutes);

// Routes du module formations.
app.use("/api/formations", formationRoutes);

// Routes du module catégories.
app.use("/api/categories", categoryRoutes);

// Routes des modules, leçons, ressources, progression et quiz.
app.use("/api", moduleRoutes);
app.use("/api", lessonRoutes);
app.use("/api", resourceRoutes);
app.use("/api", progressRoutes);
app.use("/api", quizRoutes);

// Routes du module IA.
app.use("/api/ai", aiRoutes);

// Gestionnaire central des erreurs, après les routes.
app.use(errorHandler);

export default app;
