import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Limiteur spécifique aux messages envoyés à l'assistant pédagogique IA.
export const aiMessageRateLimit = rateLimit({
  // Définit la durée de la fenêtre de limitation : une minute.
  windowMs: 60 * 1000,

  // Autorise au maximum 10 requêtes pendant cette fenêtre.
  limit: 10,

  // Génère une clé distincte pour chaque utilisateur et son tenant.
  keyGenerator: (req) => {
    const user = req.user;

    // Utilise une clé basée sur l'adresse IP si aucun utilisateur
    // authentifié n'est disponible, avec prise en charge correcte d'IPv6.
    if (!user) {
      return ipKeyGenerator(req.ip ?? "unknown");
    }

    // Sépare les compteurs par tenant et par utilisateur.
    // Le SUPER_ADMIN utilise "system" comme identifiant de tenant.
    return `${user.tenantId ?? "system"}:${user.userId}`;
  },

  // Active les en-têtes standards indiquant les limites et le quota restant.
  standardHeaders: "draft-8",

  // Désactive les anciens en-têtes de limitation.
  legacyHeaders: false,

  // Message JSON retourné lorsque la limite est dépassée.
  message: {
    success: false,
    message:
      "Trop de messages envoyés à l'assistant IA. Veuillez réessayer dans une minute.",
  },
});