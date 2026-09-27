import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import enrollmentRoutes from "./modules/enrollment/enrollment.routes.js";
import rbacRoutes from "./modules/rbac/rbac.routes.js";
import formationRoutes from "./modules/formations/formation.routes.js";
import moduleRoutes from "./modules/modules/module.routes.js";
import lessonRoutes from "./modules/lessons/lesson.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
// Création de l'application Express.
const app = express();

// Middleware permettant à Express de lire les requètes JSON.
app.use(express.json());

// Route de controle permettant de vérifier que l'API fonctionne.
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "EduAI Backend API is running",
  });
});

// Routes d'authentification.
app.use("/api/auth", authRoutes);

// Routes liées aux inscriptions aux formations.
app.use("/api/enrollments", enrollmentRoutes);

// Routes de test du contole d'accès RBAC.
app.use("/api/rbac", rbacRoutes);

// Routes du module formation.
app.use("/api/formations", formationRoutes);

// Routes du module management.
app.use("/api", moduleRoutes);

// Routes du lesson management.
app.use("/api", lessonRoutes);

// Gestionnaire centralisé des erreurs.
// Il doit etre enregistré après toutes les routes.
app.use(errorHandler);

export default app;
