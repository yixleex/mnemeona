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

  isCalculating: boolean
}

export interface AITokenCountRequest {
  project: MnemeonaProject
  activeScene: ProjectScene
  responseTokens: number

  messages?: {
    role:
      | "system"
      | "user"
      | "assistant"

    content: string
  }[]
}

// --------------------------------------------------
// Ollama
// --------------------------------------------------

interface OllamaChatResponse {
  prompt_eval_count?: unknown
  error?: string
}

interface OllamaShowResponse {
  parameters?: string

  model_info?: Record<
    string,
    unknown
  >
}

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
// Token Input
// --------------------------------------------------

export interface TokenMessage {
  role:
    | "system"
    | "user"
    | "assistant"

  content: string
}

/**
 * Builds the prompt representation used for token counting.
 *
 * The scene prose is intentionally included in the token
 * calculation because it is part of the actual AI request,
 * but it is NOT displayed in the Formatted AI Context UI.
 */
export function buildTokenizerMessages(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  messages: TokenMessage[] = [],
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

  const additionalContext =
    loadSceneAIContext(
      activeScene.id,
    ).trim()

  const result: TokenMessage[] = [
    {
      role: "system",
      content:
        systemPrompt,
    },
  ]

  /*
   * The current scene is sent as part of the request
   * context for token accounting.
   */
  if (sceneText) {
    result.push({
      role: "user",
      content:
        `CURRENT SCENE TEXT:\n${sceneText}`,
    })
  }

  /*
   * buildSystemPrompt() already includes the scene-specific
   * context. Do not add it a second time.
   */
  if (
    additionalContext &&
    !systemPrompt.includes(
      additionalContext,
    )
  ) {
    result.push({
      role: "user",
      content:
        `SCENE-SPECIFIC CONTEXT:\n${additionalContext}`,
    })
  }

  result.push(
    ...messages,
  )

  return result
}

// --------------------------------------------------
// Approximate Count
// --------------------------------------------------

/**
 * Approximate only.
 *
 * This is deliberately simple because it is only shown while
 * waiting for the selected Ollama model to calculate the real
 * prompt token count.
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

function approximateMessages(
  messages: TokenMessage[],
): number {
  const text =
    messages
      .map(
        (message) =>
          `${message.role}\n${message.content}`,
      )
      .join("\n\n")

  return estimateTokens(
    text,
  )
}

export function createApproximateAIRequestTokens(
  request: AITokenCountRequest,
  contextLength: number | null,
): AITokenCount {
  const messages =
    buildTokenizerMessages(
      request.project,
      request.activeScene,
      request.messages ?? [],
    )

  const promptTokens =
    approximateMessages(
      messages,
    )

  const responseTokens =
    Math.max(
      0,
      Math.floor(
        request.responseTokens,
      ),
    )

  const totalTokens =
    promptTokens +
    responseTokens

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

    responseTokens,

    totalTokens,

    contextLength,

    percentage,

    source:
      "estimate",

    tokenizerAvailable:
      false,

    tokenizerError:
      "Waiting for Ollama to provide the actual model token count.",

    isCalculating:
      true,
  }
}

// --------------------------------------------------
// Actual Model Count
// --------------------------------------------------

/**
 * Ollama does not expose /api/tokenize on the user's setup.
 *
 * Instead we send the exact prompt to /api/chat with
 * num_predict: 0 and read prompt_eval_count.
 *
 * This is the count generated by the selected model itself.
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
// Context Window
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
// Calculation
// --------------------------------------------------

export async function calculateAIRequestTokens(
  request: AITokenCountRequest,
  signal?: AbortSignal,
): Promise<AITokenCount> {
  const messages =
    buildTokenizerMessages(
      request.project,
      request.activeScene,
      request.messages ?? [],
    )

  /*
   * Get context size independently.
   */
  const contextLength =
    await getModelContextLength(
      signal,
    )

  /*
   * Ask the actual model for its prompt count.
   */
  const modelResult =
    await countPromptTokensWithModel(
      messages,
      signal,
    )

  /*
   * Model tokenizer succeeded.
   */
  if (
    modelResult.count !==
    null
  ) {
    const promptTokens =
      modelResult.count

    const responseTokens =
      Math.max(
        0,
        Math.floor(
          request.responseTokens,
        ),
      )

    const totalTokens =
      promptTokens +
      responseTokens

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

      responseTokens,

      totalTokens,

      contextLength,

      percentage,

      source:
        "model",

      tokenizerAvailable:
        true,

      tokenizerError:
        null,

      isCalculating:
        false,
    }
  }

  /*
   * Actual tokenizer unavailable.
   * Keep the approximate number visible.
   */
  const approximate =
    createApproximateAIRequestTokens(
      request,
      contextLength,
    )

  return {
    ...approximate,

    tokenizerError:
      modelResult.error,

    isCalculating:
      false,
  }
}

// --------------------------------------------------
// Persistent Token Store
// --------------------------------------------------

interface TokenStoreEntry {
  key: string
  value: AITokenCount
  promise: Promise<void> | null
  controller: AbortController | null
}

const tokenStore =
  new Map<
    string,
    TokenStoreEntry
  >()

const tokenListeners =
  new Set<
    () => void
  >()

function notifyTokenListeners(): void {
  for (const listener of tokenListeners) {
    listener()
  }
}

export function subscribeAITokenCounts(
  listener: () => void,
): () => void {
  tokenListeners.add(
    listener,
  )

  return () => {
    tokenListeners.delete(
      listener,
    )
  }
}

export function getAITokenCount(
  key: string,
): AITokenCount | null {
  return (
    tokenStore.get(
      key,
    )?.value ?? null
  )
}

function stableProjectKey(
  project: MnemeonaProject,
): string {
  try {
    return JSON.stringify(
      project,
    )
  } catch {
    return String(
      project,
    )
  }
}

export function createAITokenCountKey(
  request: AITokenCountRequest,
): string {
  const projectKey =
    stableProjectKey(
      request.project,
    )

  const sceneText =
    extractSceneText(
      request.activeScene,
    )

  const additionalContext =
    loadSceneAIContext(
      request.activeScene.id,
    )

  const config =
    loadAIConfig()

  const messagesKey =
    JSON.stringify(
      request.messages ?? [],
    )

  return [
    config.endpoint,
    config.model,
    request.activeScene.id,
    request.responseTokens,
    sceneText,
    additionalContext,
    projectKey,
    messagesKey,
  ].join("|")
}

/**
 * Starts or reuses the calculation for a prompt.
 *
 * This function deliberately lives outside React.
 *
 * Therefore closing AIContextPanel does NOT cancel the request.
 */
export function ensureAITokenCount(
  request: AITokenCountRequest,
): string {
  const key =
    createAITokenCountKey(
      request,
    )

  const existing =
    tokenStore.get(key)

  if (
    existing?.promise
  ) {
    return key
  }

  if (
    existing?.value &&
    existing.value.source ===
      "model" &&
    !existing.value.isCalculating
  ) {
    return key
  }

  const approximate =
    createApproximateAIRequestTokens(
      request,
      existing?.value.contextLength ??
        null,
    )

  const controller =
    new AbortController()

  const entry: TokenStoreEntry =
    existing ?? {
      key,
      value:
        approximate,
      promise: null,
      controller: null,
    }

  entry.value =
    approximate

  entry.controller =
    controller

  const promise =
    calculateAIRequestTokens(
      request,
      controller.signal,
    )
      .then(
        (result) => {
          entry.value =
            result

          entry.promise =
            null

          entry.controller =
            null

          notifyTokenListeners()
        },
      )
      .catch(
        (error) => {
          if (
            controller.signal
              .aborted
          ) {
            return
          }

          entry.value = {
            ...approximate,

            tokenizerError:
              error instanceof
              Error
                ? error.message
                : "Unable to calculate the model token count.",

            isCalculating:
              false,
          }

          entry.promise =
            null

          entry.controller =
            null

          notifyTokenListeners()
        },
      )

  entry.promise =
    promise

  tokenStore.set(
    key,
    entry,
  )

  notifyTokenListeners()

  return key
}

export function invalidateAITokenCount(
  request: AITokenCountRequest,
): void {
  const key =
    createAITokenCountKey(
      request,
    )

  const entry =
    tokenStore.get(key)

  if (!entry) {
    return
  }

  /*
   * Do not cancel here.
   *
   * The calculation may still be useful if the panel
   * is reopened. Removing the cache entry is enough.
   */
  tokenStore.delete(
    key,
  )

  notifyTokenListeners()
}

// --------------------------------------------------
// Formatting
// --------------------------------------------------

export function formatTokenCount(
  value: number,
): string {
  return value.toLocaleString()
}
