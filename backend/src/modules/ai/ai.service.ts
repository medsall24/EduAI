
import { getActiveAIConfig, aiConfig } from "../../config/ai.config.js";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIResponse {
  success: true;
  provider: "gemini" | "openrouter";
  model: string;
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: {
    message?: string;
  };
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

const REQUEST_TIMEOUT_MS = 30_000;

// Vérifie et normalise une valeur de consommation de tokens.
// Retourne null lorsque la valeur est absente ou invalide.
function normalizeTokenCount(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function askGemini(
  messages: AIMessage[],
  systemInstruction?: string,
): Promise<AIResponse> {
  const config = getActiveAIConfig();

  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.model,
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    },
  );

  let data: GeminiResponse;

try {
  data = (await response.json()) as GeminiResponse;
} catch {
  if (!response.ok) {
    throw new Error(
      `Gemini API error (${response.status}): Request failed`,
    );
  }

  throw new Error("Gemini returned an invalid JSON response.");
}

if (!response.ok) {
  throw new Error(
    `Gemini API error (${response.status}): ${
      data.error?.message ?? "Request failed"
    }`,
  );
}

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

    return {
    success: true,
    provider: "gemini",
    model: config.model,
    content,
    // Enregistre le nombre de tokens transmis au modèle.
    inputTokens: normalizeTokenCount(
      data.usageMetadata?.promptTokenCount,
    ),
    // Enregistre le nombre de tokens générés par le modèle.
    outputTokens: normalizeTokenCount(
      data.usageMetadata?.candidatesTokenCount,
    ),
  };
}

async function askOpenRouter(
  messages: AIMessage[],
  systemInstruction?: string,
): Promise<AIResponse> {
  const config = getActiveAIConfig();

  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "EduAI",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(systemInstruction
            ? [{ role: "system", content: systemInstruction }]
            : []),
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    },
  );

  let data: OpenRouterResponse;

try {
  data = (await response.json()) as OpenRouterResponse;
} catch {
  if (!response.ok) {
    throw new Error(
      `OpenRouter API error (${response.status}): Request failed`,
    );
  }

  throw new Error("OpenRouter returned an invalid JSON response.");
}

if (!response.ok) {
  throw new Error(
    `OpenRouter API error (${response.status}): ${
      data.error?.message ?? "Request failed"
    }`,
  );
}

  const rawContent = data.choices?.[0]?.message?.content;

  const content =
    typeof rawContent === "string"
      ? rawContent.trim()
      : rawContent
          ?.map((part) => (part.type === "text" ? part.text ?? "" : ""))
          .join("")
          .trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

    return {
    success: true,
    provider: "openrouter",
    model: config.model,
    content,
    // Enregistre le nombre de tokens transmis au modèle.
    inputTokens: normalizeTokenCount(data.usage?.prompt_tokens),
    // Enregistre le nombre de tokens générés par le modèle.
    outputTokens: normalizeTokenCount(data.usage?.completion_tokens),
  };
}

export async function askAI(
  messages: AIMessage[],
  systemInstruction?: string,
): Promise<AIResponse> {
  // Vérifie qu'au moins un message est fourni.
  if (messages.length === 0) {
    throw new Error("At least one message is required.");
  }

  // Refuse les messages dont le contenu est vide.
  for (const message of messages) {
    if (!message.content.trim()) {
      throw new Error("Messages cannot be empty.");
    }
  }

  // Sélectionne le fournisseur configuré.
  if (aiConfig.provider === "gemini") {
    return askGemini(messages, systemInstruction);
  }

  return askOpenRouter(messages, systemInstruction);
}