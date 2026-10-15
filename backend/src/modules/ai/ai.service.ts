
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
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
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
  error?: {
    message?: string;
  };
}

const REQUEST_TIMEOUT_MS = 30_000;

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

  const data = (await response.json()) as GeminiResponse;

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

  const data = (await response.json()) as OpenRouterResponse;

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
  };
}

export async function askAI(
  messages: AIMessage[],
  systemInstruction?: string,
): Promise<AIResponse> {
  if (messages.length === 0) {
    throw new Error("At least one message is required.");
  }

  for (const message of messages) {
    if (!message.content.trim()) {
      throw new Error("Messages cannot be empty.");
    }
  }

  if (aiConfig.provider === "gemini") {
    return askGemini(messages, systemInstruction);
  }

  return askOpenRouter(messages, systemInstruction);
}
