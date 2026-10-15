
import "dotenv/config";

export type AIProvider = "gemini" | "openrouter";

interface AIProviderConfig {
  apiKey: string;
  model: string;
}

const getOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const providerValue = (
  process.env["AI_PROVIDER"] ?? "gemini"
).trim().toLowerCase();

if (providerValue !== "gemini" && providerValue !== "openrouter") {
  throw new Error(
    'AI_PROVIDER must be either "gemini" or "openrouter".',
  );
}

export const aiConfig = {
  provider: providerValue as AIProvider,
  gemini: {
    apiKey: getOptionalEnv("GEMINI_API_KEY"),
    model: getOptionalEnv("GEMINI_MODEL"),
  },
  openrouter: {
    apiKey: getOptionalEnv("OPENROUTER_API_KEY"),
    model: getOptionalEnv("OPENROUTER_MODEL"),
  },
} as const;

export function getActiveAIConfig(): AIProviderConfig {
  const config = aiConfig[aiConfig.provider];

  if (!config.apiKey) {
    throw new Error(
      `Missing required environment variable: ${
        aiConfig.provider === "gemini"
          ? "GEMINI_API_KEY"
          : "OPENROUTER_API_KEY"
      }`,
    );
  }

  if (!config.model) {
    throw new Error(
      `Missing required environment variable: ${
        aiConfig.provider === "gemini"
          ? "GEMINI_MODEL"
          : "OPENROUTER_MODEL"
      }`,
    );
  }

  return {
    apiKey: config.apiKey,
    model: config.model,
  };
}
