import express from "express";

import authRoutes from "./modules/auth/auth.routes.js";
import enrollmentRoutes from "./modules/enrollment/enrollment.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
// Création de l'application Express.
const app = express();

// Middleware permettant à Express de lire les requêtes JSON.
app.use(express.json());

// Route de contrôle permettant de vérifier que l'API fonctionne.
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

// Gestionnaire centralisé des erreurs.
// Il doit être enregistré après toutes les routes.
app.use(errorHandler);

export default app;