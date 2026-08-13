import {
  buildSystemPrompt,
  loadAIConfig,
  loadSceneAIContext,
} from "./aiService"

import type { MnemeonaProject } from "@/types/project"

type ProjectScene =
  MnemeonaProject["manuscript"]["acts"][number]["chapters"][number]["scenes"][number]

export interface AITokenCount {
  promptTokens: number
  responseTokens: number
  totalTokens: number
  contextLength: number | null
  percentage: number | null
  source: "tokenizer" | "estimate"
  tokenizerAvailable: boolean
  tokenizerError: string | null
}

interface OllamaTokenizeResponse {
  tokens?: unknown
  token_count?: unknown
}

interface OllamaShowResponse {
  parameters?: string
  model_info?: Record<string, unknown>
}

/**
 * Normalizes the configured Ollama endpoint.
 *
 * Supports:
 *   http://localhost:11434
 *   http://localhost:11434/
 *   http://localhost:11434/api
 *   http://localhost:11434/api/
 */
function getOllamaBaseUrl(
  endpoint: string,
): string {
  return endpoint
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")
    .replace(/\/+$/, "")
}

/**
 * Extract the actual prose from the current scene.
 *
 * The scene is deliberately NOT added to buildSceneContext().
 * It is only included in the token calculation because the
 * actual scene text is sent to the model separately.
 */
function extractSceneText(
  scene: ProjectScene,
): string {
  const content =
    scene.content

  if (!content) {
    return ""
  }

  const extractNode = (
    node: unknown,
  ): string => {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return ""
    }

    const current =
      node as {
        text?: string
        content?: unknown[]
      }

    const parts: string[] = []

    if (
      typeof current.text ===
      "string"
    ) {
      parts.push(
        current.text,
      )
    }

    if (
      Array.isArray(
        current.content,
      )
    ) {
      for (const child of current.content) {
        const childText =
          extractNode(child)

        if (childText) {
          parts.push(childText)
        }
      }
    }

    return parts.join(" ")
  }

  return extractNode(content).trim()
}

/**
 * Build the same conceptual input that is sent to the AI.
 *
 * The current scene is included here for token counting but
 * remains absent from the visible Formatted AI Context panel.
 */
function buildTokenizerInput(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  messages: {
    role:
      | "system"
      | "user"
      | "assistant"
    content: string
  }[],
): string {
  const systemPrompt =
    buildSystemPrompt(
      project,
      activeScene,
    )

  const sceneText =
    extractSceneText(
      activeScene,
    )

  const additionalContext =
    loadSceneAIContext(
      activeScene.id,
    ).trim()

  const messageText =
    messages
      .map(
        (message) =>
          `${message.role.toUpperCase()}:\n${message.content}`,
      )
      .join("\n\n")

  return [
    "SYSTEM:",
    systemPrompt,

    sceneText
      ? `CURRENT SCENE TEXT:\n${sceneText}`
      : "",

    /*
     * Normally Additional Context is already represented
     * by buildSystemPrompt(). Only add it independently
     * if it isn't already there.
     */
    additionalContext &&
    !systemPrompt.includes(
      additionalContext,
    )
      ? `SCENE-SPECIFIC CONTEXT:\n${additionalContext}`
      : "",

    messageText,
  ]
    .filter(Boolean)
    .join("\n\n")
}

/**
 * Tokenize text using the selected Ollama model.
 *
 * Returns both the count and an error so the UI can tell
 * the difference between:
 *
 *   - tokenizer unavailable
 *   - invalid endpoint
 *   - model not found
 *   - server error
 *   - malformed response
 */
async function tokenizeWithOllama(
  text: string,
  signal?: AbortSignal,
): Promise<{
  count: number | null
  error: string | null
}> {
  const config =
    loadAIConfig()

  if (
    !config.endpoint.trim()
  ) {
    return {
      count: null,
      error:
        "Ollama endpoint is not configured.",
    }
  }

  if (
    !config.model.trim()
  ) {
    return {
      count: null,
      error:
        "No AI model is selected.",
    }
  }

  if (!text.trim()) {
    return {
      count: 0,
      error: null,
    }
  }

  const baseUrl =
    getOllamaBaseUrl(
      config.endpoint,
    )

  const url =
    `${baseUrl}/api/tokenize`

  try {
    const response =
      await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...(config.apiKey
            ? {
                Authorization:
                  `Bearer ${config.apiKey}`,
              }
            : {}),
        },

        body: JSON.stringify({
          model:
            config.model,
          content:
            text,
        }),

        signal,
      })

    const rawBody =
      await response.text()

    if (!response.ok) {
      let detail =
        rawBody.trim()

      try {
        const parsed =
          JSON.parse(rawBody) as {
            error?: unknown
          }

        if (
          typeof parsed.error ===
          "string"
        ) {
          detail =
            parsed.error
        }
      } catch {
        // Keep the raw response.
      }

      if (!detail) {
        detail =
          response.statusText ||
          "Unknown Ollama error."
      }

      return {
        count: null,
        error:
          `Ollama tokenizer returned HTTP ${response.status}: ${detail}`,
      }
    }

    let data:
      | OllamaTokenizeResponse

    try {
      data =
        JSON.parse(
          rawBody,
        ) as OllamaTokenizeResponse
    } catch {
      return {
        count: null,
        error:
          "Ollama tokenizer returned invalid JSON.",
      }
    }

    if (
      Array.isArray(
        data.tokens,
      )
    ) {
      return {
        count:
          data.tokens.length,
        error: null,
      }
    }

    if (
      typeof data.token_count ===
        "number" &&
      Number.isFinite(
        data.token_count,
      )
    ) {
      return {
        count: Math.max(
          0,
          Math.floor(
            data.token_count,
          ),
        ),
        error: null,
      }
    }

    return {
      count: null,
      error:
        "Ollama tokenizer response did not contain a token count.",
    }
  } catch (error) {
    if (
      error instanceof
      DOMException &&
      error.name ===
        "AbortError"
    ) {
      return {
        count: null,
        error: "Request cancelled.",
      }
    }

    if (
      error instanceof Error
    ) {
      return {
        count: null,
        error:
          `Could not reach Ollama tokenizer: ${error.message}`,
      }
    }

    return {
      count: null,
      error:
        "Could not reach the Ollama tokenizer.",
    }
  }
}

/**
 * Fallback only.
 *
 * This is NOT model-accurate and should only be used when
 * /api/tokenize isn't available.
 */
function estimateTokens(
  text: string,
): number {
  if (!text.trim()) {
    return 0
  }

  return Math.ceil(
    text.length / 4,
  )
}

/**
 * Find the model's context window through /api/show.
 */
export async function getModelContextLength(
  signal?: AbortSignal,
): Promise<number | null> {
  const config =
    loadAIConfig()

  if (
    !config.endpoint.trim() ||
    !config.model.trim()
  ) {
    return null
  }

  const baseUrl =
    getOllamaBaseUrl(
      config.endpoint,
    )

  try {
    const response =
      await fetch(
        `${baseUrl}/api/show`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(config.apiKey
              ? {
                  Authorization:
                    `Bearer ${config.apiKey}`,
                }
              : {}),
          },

          body: JSON.stringify({
            model:
              config.model,
            verbose:
              true,
          }),

          signal,
        },
      )

    if (!response.ok) {
      return null
    }

    const data =
      (await response.json()) as OllamaShowResponse

    /*
     * If the model has an explicit num_ctx parameter,
     * that is the effective context size configured for it.
     */
    if (
      typeof data.parameters ===
      "string"
    ) {
      const match =
        data.parameters.match(
          /(?:^|\s)num_ctx\s+(\d+)/i,
        )

      if (match) {
        const value =
          Number(match[1])

        if (
          Number.isFinite(
            value,
          ) &&
          value > 0
        ) {
          return Math.floor(
            value,
          )
        }
      }
    }

    const modelInfo =
      data.model_info

    if (!modelInfo) {
      return null
    }

    const direct =
      modelInfo.context_length

    if (
      typeof direct ===
        "number" &&
      Number.isFinite(
        direct,
      ) &&
      direct > 0
    ) {
      return Math.floor(
        direct,
      )
    }

    /*
     * Ollama commonly exposes architecture-prefixed
     * fields such as:
     *
     *   qwen3.context_length
     *   llama.context_length
     */
    for (const [
      key,
      value,
    ] of Object.entries(
      modelInfo,
    )) {
      if (
        key
          .toLowerCase()
          .endsWith(
            ".context_length",
          ) &&
        typeof value ===
          "number" &&
        Number.isFinite(
          value,
        ) &&
        value > 0
      ) {
        return Math.floor(
          value,
        )
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Calculate the live token budget.
 *
 * promptTokens:
 *   Actual model tokenizer count when available.
 *
 * responseTokens:
 *   Current Continue AI slider value.
 *
 * totalTokens:
 *   Prompt + reserved response.
 */
export async function estimateAIRequestTokens(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  responseTokens: number,
  messages: {
    role:
      | "system"
      | "user"
      | "assistant"
    content: string
  }[] = [],
  signal?: AbortSignal,
): Promise<AITokenCount> {
  const tokenizerInput =
    buildTokenizerInput(
      project,
      activeScene,
      messages,
    )

  const tokenizerResult =
    await tokenizeWithOllama(
      tokenizerInput,
      signal,
    )

  const tokenizerAvailable =
    tokenizerResult.count !==
    null

  const promptTokens =
    tokenizerAvailable
      ? tokenizerResult.count!
      : estimateTokens(
          tokenizerInput,
        )

  const normalizedResponseTokens =
    Math.max(
      0,
      Math.floor(
        responseTokens,
      ),
    )

  const totalTokens =
    promptTokens +
    normalizedResponseTokens

  const contextLength =
    await getModelContextLength(
      signal,
    )

  const percentage =
    contextLength &&
    contextLength > 0
      ? Math.min(
          100,
          (totalTokens /
            contextLength) *
            100,
        )
      : null

  return {
    promptTokens,
    responseTokens:
      normalizedResponseTokens,
    totalTokens,
    contextLength,
    percentage,
    source:
      tokenizerAvailable
        ? "tokenizer"
        : "estimate",
    tokenizerAvailable,
    tokenizerError:
      tokenizerResult.error,
  }
}

/**
 * Format a token count for display.
 */
export function formatTokenCount(
  value: number,
): string {
  return value.toLocaleString()
}
