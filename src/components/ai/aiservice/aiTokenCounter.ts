import {
  buildSystemPrompt,
  loadAIConfig,
} from "./aiService"

import type { MnemeonaProject } from "@/types/project"

type ProjectScene =
  MnemeonaProject["manuscript"]["acts"][number]["chapters"][number]["scenes"][number]

export interface AITokenCount {
  promptTokens: number
  responseTokens: number
  totalTokens: number

  contextLength:
    | number
    | null

  percentage:
    | number
    | null

  source:
    | "model"
    | "estimate"

  tokenizerAvailable: boolean

  tokenizerError:
    | string
    | null
}

interface OllamaChatResponse {
  prompt_eval_count?: unknown

  eval_count?: unknown

  done?: boolean

  error?: string

  message?: {
    role?: string
    content?: string
  }
}

interface OllamaShowResponse {
  parameters?: string

  model_info?: Record<
    string,
    unknown
  >
}

// --------------------------------------------------
// Ollama URL
// --------------------------------------------------

function getOllamaBaseUrl(
  endpoint: string,
): string {
  return endpoint
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "")
    .replace(/\/+$/, "")
}

// --------------------------------------------------
// Scene Text
// --------------------------------------------------

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
          parts.push(
            childText,
          )
        }
      }
    }

    return parts.join(" ")
  }

  return extractNode(
    content,
  ).trim()
}

// --------------------------------------------------
// Prompt Messages
// --------------------------------------------------

interface TokenMessage {
  role:
    | "system"
    | "user"
    | "assistant"

  content: string
}

/**
 * Builds the messages that represent the prompt being
 * measured.
 *
 * The scene text is included for token accounting, but
 * is intentionally NOT shown in the Formatted AI Context
 * section of the UI.
 */
function buildTokenMessages(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  messages: TokenMessage[],
): TokenMessage[] {
  const systemPrompt =
    buildSystemPrompt(
      project,
      activeScene,
    )

  const sceneText =
    extractSceneText(
      activeScene,
    )

  return [
    {
      role: "system",
      content:
        systemPrompt,
    },

    ...(sceneText
      ? [
          {
            role: "user" as const,
            content:
              `CURRENT SCENE TEXT:\n\n${sceneText}`,
          },
        ]
      : []),

    ...messages,
  ]
}

// --------------------------------------------------
// Fallback Estimation
// --------------------------------------------------

/**
 * Deliberately approximate.
 *
 * This is only used while waiting for Ollama's actual
 * model-side token count or if the model cannot provide one.
 */
export function estimateTokens(
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
 * Creates the approximate result immediately.
 *
 * This allows the UI to show useful information while
 * Ollama is still processing the real token count.
 */
export function createApproximateAIRequestTokens(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  responseTokens: number,
  messages: TokenMessage[] = [],
  contextLength: number | null = null,
): AITokenCount {
  const tokenMessages =
    buildTokenMessages(
      project,
      activeScene,
      messages,
    )

  const promptText =
    tokenMessages
      .map(
        (message) =>
          `${message.role}\n${message.content}`,
      )
      .join("\n\n")

  const promptTokens =
    estimateTokens(
      promptText,
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
      "estimate",

    tokenizerAvailable:
      false,

    tokenizerError:
      "Waiting for Ollama to provide the actual model token count.",
  }
}

// --------------------------------------------------
// Model Token Count
// --------------------------------------------------

/**
 * Ask Ollama to evaluate the exact prompt through /api/chat.
 *
 * We intentionally do NOT use /api/tokenize because the user's
 * Ollama installation does not expose that endpoint.
 *
 * num_predict: 0 prevents generation while allowing Ollama
 * to evaluate the prompt and return prompt_eval_count.
 */
async function countPromptTokensWithModel(
  messages: TokenMessage[],
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

  const baseUrl =
    getOllamaBaseUrl(
      config.endpoint,
    )

  try {
    const response =
      await fetch(
        `${baseUrl}/api/chat`,
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

            messages,

            stream: false,

            options: {
              num_predict: 0,
            },
          }),

          signal,
        },
      )

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
        // Keep raw response.
      }

      return {
        count: null,

        error:
          `Ollama prompt evaluation returned HTTP ${response.status}: ${
            detail ||
            response.statusText ||
            "Unknown error."
          }`,
      }
    }

    let data:
      | OllamaChatResponse

    try {
      data =
        JSON.parse(
          rawBody,
        ) as OllamaChatResponse
    } catch {
      return {
        count: null,

        error:
          "Ollama returned invalid JSON while measuring the prompt.",
      }
    }

    if (data.error) {
      return {
        count: null,

        error:
          `Ollama returned an error while measuring the prompt: ${data.error}`,
      }
    }

    if (
      typeof data.prompt_eval_count ===
        "number" &&
      Number.isFinite(
        data.prompt_eval_count,
      )
    ) {
      return {
        count: Math.max(
          0,
          Math.floor(
            data.prompt_eval_count,
          ),
        ),

        error: null,
      }
    }

    return {
      count: null,

      error:
        "Ollama did not return prompt_eval_count.",
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
        error:
          "Request cancelled.",
      }
    }

    if (
      error instanceof Error
    ) {
      return {
        count: null,

        error:
          `Could not reach Ollama: ${error.message}`,
      }
    }

    return {
      count: null,

      error:
        "Could not reach Ollama.",
    }
  }
}

// --------------------------------------------------
// Model Context Window
// --------------------------------------------------

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

            verbose: true,
          }),

          signal,
        },
      )

    if (!response.ok) {
      return null
    }

    const data =
      (await response.json()) as OllamaShowResponse

    if (
      typeof data.parameters ===
      "string"
    ) {
      const match =
        data.parameters.match(
          /(?:^|\s)num_ctx\s+(\d+)/i,
        )

      if (match?.[1]) {
        const value =
          Number(
            match[1],
          )

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

// --------------------------------------------------
// Complete Token Calculation
// --------------------------------------------------

export async function estimateAIRequestTokens(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  responseTokens: number,
  messages: TokenMessage[] = [],
  signal?: AbortSignal,
): Promise<AITokenCount> {
  const tokenMessages =
    buildTokenMessages(
      project,
      activeScene,
      messages,
    )

  const normalizedResponseTokens =
    Math.max(
      0,
      Math.floor(
        responseTokens,
      ),
    )

  /*
   * Calculate the fallback immediately.
   */
  const promptText =
    tokenMessages
      .map(
        (message) =>
          `${message.role}\n${message.content}`,
      )
      .join("\n\n")

  const approximatePromptTokens =
    estimateTokens(
      promptText,
    )

  const approximateTotalTokens =
    approximatePromptTokens +
    normalizedResponseTokens

  /*
   * Fetch the model context size independently.
   */
  const contextLength =
    await getModelContextLength(
      signal,
    )

  /*
   * Ask the actual model for its prompt token count.
   */
  const modelResult =
    await countPromptTokensWithModel(
      tokenMessages,
      signal,
    )

  /*
   * Ollama successfully gave us the actual count.
   */
  if (
    modelResult.count !==
    null
  ) {
    const promptTokens =
      modelResult.count

    const totalTokens =
      promptTokens +
      normalizedResponseTokens

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
        "model",

      tokenizerAvailable:
        true,

      tokenizerError:
        null,
    }
  }

  /*
   * Ollama failed to provide the actual count.
   *
   * Return the approximate number instead of hiding
   * the gauge.
   */
  const approximatePercentage =
    contextLength &&
    contextLength > 0
      ? Math.min(
          100,
          (approximateTotalTokens /
            contextLength) *
            100,
        )
      : null

  return {
    promptTokens:
      approximatePromptTokens,

    responseTokens:
      normalizedResponseTokens,

    totalTokens:
      approximateTotalTokens,

    contextLength,

    percentage:
      approximatePercentage,

    source:
      "estimate",

    tokenizerAvailable:
      false,

    tokenizerError:
      modelResult.error,
  }
}

// --------------------------------------------------
// Formatting
// --------------------------------------------------

export function formatTokenCount(
  value: number,
): string {
  return value.toLocaleString()
}
