
import app from "./app.js";
import { prisma } from "./config/prisma.js";
import {
  startLearningPathOutboxWorker,
  stopLearningPathOutboxWorker,
} from "./modules/ai/learning-path-outbox.worker.js";
import { handleLearningPathEvent } from "./modules/ai/learning-path-event.handler.js";

const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`EduAI Backend running on port ${PORT}`);

  startLearningPathOutboxWorker(handleLearningPathEvent);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log(`[Server] Signal ${signal} reçu. Arrêt en cours...`);

  try {
    await stopLearningPathOutboxWorker();

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await prisma.$disconnect();

    console.log("[Server] Arrêt terminé.");
    process.exitCode = 0;
  } catch (error) {
    console.error("[Server] Erreur pendant l'arrêt :", error);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});