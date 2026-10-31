
import { afterEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  aiConfig: {
    provider: "gemini" as "gemini" | "openrouter",
  },
  getActiveAIConfig: vi.fn(),
}));

vi.mock("../src/config/ai.config.js", () => configMocks);

import { askAI } from "../src/modules/ai/ai.service.js";

const mockFetch = vi.fn();

function mockResponse(
  body: unknown,
  options: { status?: number; ok?: boolean } = {},
): Response {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);

  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("AI service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("refuse une liste de messages vide", async () => {
    await expect(askAI([])).rejects.toThrow(
      "At least one message is required.",
    );
  });

  it("refuse un message vide ou composé d'espaces", async () => {
    await expect(
      askAI([{ role: "user", content: "   " }]),
    ).rejects.toThrow("Messages cannot be empty.");
  });

  it("envoie une requête Gemini et retourne le texte généré", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Bonjour " }, { text: "EduAI !" }],
            },
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI(
      [{ role: "user", content: "Bonjour" }],
      "Tu es un assistant pédagogique.",
    );

    expect(result).toEqual({
  success: true,
  provider: "gemini",
  model: "test-gemini-model",
  content: "Bonjour EduAI !",
  inputTokens: null,
  outputTokens: null,
});

    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toContain(
      "/v1beta/models/test-gemini-model:generateContent",
    );
    expect(options.method).toBe("POST");
    expect(
      (options.headers as Record<string, string>)["x-goog-api-key"],
    ).toBe("test-gemini-key");

    const body = JSON.parse(String(options.body));

    expect(body.systemInstruction.parts[0].text).toBe(
      "Tu es un assistant pédagogique.",
    );
    expect(body.contents[0].role).toBe("user");
  });

  it("convertit le rôle assistant en rôle model pour Gemini", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        candidates: [
          { content: { parts: [{ text: "Réponse" }] } },
        ],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    await askAI([
      { role: "user", content: "Question" },
      { role: "assistant", content: "Réponse précédente" },
    ]);

    const [, options] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(options.body));

    expect(body.contents[1].role).toBe("model");
  });

  it("retourne une erreur explicite en cas d'erreur HTTP Gemini", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse(
        { error: { message: "Quota dépassé" } },
        { status: 429 },
      ),
    );

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow("Gemini API error (429): Quota dépassé");
  });

  it("refuse une réponse Gemini vide", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        candidates: [{ content: { parts: [{ text: "   " }] } }],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow("Gemini returned an empty response.");
  });

  it("envoie une requête OpenRouter et retourne le texte généré", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        choices: [
          { message: { content: "Réponse OpenRouter" } },
        ],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI([
      { role: "user", content: "Bonjour" },
    ]);

    expect(result).toEqual({
  success: true,
  provider: "openrouter",
  model: "test-openrouter-model",
  content: "Réponse OpenRouter",
  inputTokens: null,
  outputTokens: null,
});

    const [url, options] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(
      (options.headers as Record<string, string>).Authorization,
    ).toBe("Bearer test-openrouter-key");
  });

  it("convertit les rôles et ajoute l'instruction système pour OpenRouter", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: "Réponse" } }],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    await askAI(
      [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Réponse précédente" },
      ],
      "Instruction système",
    );

    const [, options] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(options.body));

    expect(body.messages).toEqual([
      { role: "system", content: "Instruction système" },
      { role: "user", content: "Question" },
      { role: "assistant", content: "Réponse précédente" },
    ]);
  });

  it("accepte un contenu OpenRouter composé de plusieurs parties textuelles", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "Première partie " },
                { type: "image", text: "ignorée" },
                { type: "text", text: "seconde partie" },
              ],
            },
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI([
      { role: "user", content: "Question" },
    ]);

    expect(result.content).toBe("Première partie seconde partie");
  });

  it("retourne une erreur explicite en cas d'erreur HTTP OpenRouter", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse(
        { error: { message: "Modèle indisponible" } },
        { status: 503 },
      ),
    );

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow(
      "OpenRouter API error (503): Modèle indisponible",
    );
  });

  it("refuse une réponse OpenRouter vide", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        choices: [{ message: { content: "   " } }],
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow("OpenRouter returned an empty response.");
  });

  it("propage une erreur de configuration sans appeler le réseau", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockImplementation(() => {
      throw new Error("Missing required environment variable: GEMINI_API_KEY");
    });

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow("Missing required environment variable: GEMINI_API_KEY");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  
  it("gère une réponse Gemini dont le corps n'est pas du JSON valide", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(
        new SyntaxError("Unexpected token in JSON"),
      ),
    } as unknown as Response);

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      askAI([{ role: "user", content: "Bonjour" }]),
    ).rejects.toThrow("Gemini API error (502): Request failed");
  });

  
it("gère une réponse OpenRouter dont le corps n'est pas du JSON valide", async () => {
  configMocks.aiConfig.provider = "openrouter";
  configMocks.getActiveAIConfig.mockReturnValue({
    apiKey: "test-openrouter-key",
    model: "test-openrouter-model",
  });

  mockFetch.mockResolvedValue({
    ok: false,
    status: 502,
    json: vi.fn().mockRejectedValue(
      new SyntaxError("Unexpected token in JSON"),
    ),
  } as unknown as Response);

  vi.stubGlobal("fetch", mockFetch);

  await expect(
    askAI([{ role: "user", content: "Bonjour" }]),
  ).rejects.toThrow("OpenRouter API error (502): Request failed");
});


it("propage une erreur lorsque la requête Gemini dépasse le délai autorisé", async () => {
  configMocks.aiConfig.provider = "gemini";
  configMocks.getActiveAIConfig.mockReturnValue({
    apiKey: "test-gemini-key",
    model: "test-gemini-model",
  });

  const timeoutError = new DOMException(
    "The operation was aborted due to timeout",
    "TimeoutError",
  );

  mockFetch.mockRejectedValue(timeoutError);
  vi.stubGlobal("fetch", mockFetch);

  await expect(
    askAI([{ role: "user", content: "Bonjour" }]),
  ).rejects.toThrow("The operation was aborted due to timeout");

  expect(mockFetch).toHaveBeenCalledOnce();
});


it("propage une erreur lorsque la requête OpenRouter dépasse le délai autorisé", async () => {
  configMocks.aiConfig.provider = "openrouter";
  configMocks.getActiveAIConfig.mockReturnValue({
    apiKey: "test-openrouter-key",
    model: "test-openrouter-model",
  });

  const timeoutError = new DOMException(
    "The operation was aborted due to timeout",
    "TimeoutError",
  );

  mockFetch.mockRejectedValue(timeoutError);
  vi.stubGlobal("fetch", mockFetch);

  await expect(
    askAI([{ role: "user", content: "Bonjour" }]),
  ).rejects.toThrow("The operation was aborted due to timeout");

  expect(mockFetch).toHaveBeenCalledOnce();
});

  it("extrait les tokens consommés par Gemini", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Réponse Gemini" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 45,
        },
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI([
      { role: "user", content: "Question de test" },
    ]);

    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(45);
  });

  it("extrait les tokens consommés par OpenRouter", async () => {
    configMocks.aiConfig.provider = "openrouter";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-openrouter-key",
      model: "test-openrouter-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        choices: [
          {
            message: {
              content: "Réponse OpenRouter",
            },
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 60,
        },
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI([
      { role: "user", content: "Question de test" },
    ]);

    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(60);
  });

  it("normalise les valeurs de tokens invalides en null", async () => {
    configMocks.aiConfig.provider = "gemini";
    configMocks.getActiveAIConfig.mockReturnValue({
      apiKey: "test-gemini-key",
      model: "test-gemini-model",
    });

    mockFetch.mockResolvedValue(
      mockResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Réponse Gemini" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: -10,
          candidatesTokenCount: 12.5,
        },
      }),
    );

    vi.stubGlobal("fetch", mockFetch);

    const result = await askAI([
      { role: "user", content: "Question de test" },
    ]);

    expect(result.inputTokens).toBeNull();
    expect(result.outputTokens).toBeNull();
  });
});
