import {
  buildSceneContext,
  formatStoryContext,
} from "../context/buildSceneContext"

import type { MnemeonaProject } from "@/types/project"

// --------------------------------------------------
// Storage
// --------------------------------------------------

const STORAGE_KEY =
  "mnemeona-ai-settings"

const CONTINUE_WRITING_TOKENS_KEY =
  "mnemeona-ai-continue-writing-tokens"

const SCENE_AI_CONTEXT_PREFIX =
  "mnemeona-ai-scene-context:"

const DEFAULT_CONTINUE_WRITING_TOKENS =
  1024

const MIN_CONTINUE_WRITING_TOKENS =
  128

const MAX_CONTINUE_WRITING_TOKENS =
  4096

const CONTINUE_WRITING_TOKEN_STEP =
  128

// --------------------------------------------------
// Types
// --------------------------------------------------

export interface AIConfig {
  provider: "local"
  endpoint: string
  model: string
  apiKey: string
}

export const DEFAULT_CONFIG: AIConfig = {
  provider: "local",
  endpoint: "http://localhost:11434",
  model: "",
  apiKey: "",
}

export interface AIMessage {
  role:
    | "system"
    | "user"
    | "assistant"
  content: string
}

type ProjectScene =
  MnemeonaProject["manuscript"]["acts"][number]["chapters"][number]["scenes"][number]

export interface AIChatOptions {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  signal?: AbortSignal
  onToken?: (token: string) => void
  systemPrompt?: string
  continueWritingTokens?: number
}

interface AICompletionOptions {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  signal?: AbortSignal
  systemPrompt?: string
}

export interface AIModelContextInfo {
  model: string
  contextLength: number | null
  source:
    | "running"
    | "configured"
    | "model"
    | "unknown"
}

// --------------------------------------------------
// Continue AI Response Length
// --------------------------------------------------

export function loadContinueWritingLength(): number {
  try {
    const stored =
      localStorage.getItem(
        CONTINUE_WRITING_TOKENS_KEY,
      )

    if (!stored) {
      return DEFAULT_CONTINUE_WRITING_TOKENS
    }

    const parsed =
      Number(stored)

    if (
      !Number.isFinite(parsed)
    ) {
      return DEFAULT_CONTINUE_WRITING_TOKENS
    }

    return normalizeContinueWritingTokens(
      parsed,
    )
  } catch {
    return DEFAULT_CONTINUE_WRITING_TOKENS
  }
}

export function saveContinueWritingLength(
  tokens: number,
): void {
  const normalized =
    normalizeContinueWritingTokens(
      tokens,
    )

  localStorage.setItem(
    CONTINUE_WRITING_TOKENS_KEY,
    String(normalized),
  )
}

function normalizeContinueWritingTokens(
  tokens: number,
): number {
  return Math.min(
    MAX_CONTINUE_WRITING_TOKENS,
    Math.max(
      MIN_CONTINUE_WRITING_TOKENS,
      Math.round(
        tokens /
          CONTINUE_WRITING_TOKEN_STEP,
      ) *
        CONTINUE_WRITING_TOKEN_STEP,
    ),
  )
}

// --------------------------------------------------
// Scene-Specific AI Context
// --------------------------------------------------

export function loadSceneAIContext(
  sceneId: string,
): string {
  try {
    return (
      localStorage.getItem(
        `${SCENE_AI_CONTEXT_PREFIX}${sceneId}`,
      ) ?? ""
    )
  } catch {
    return ""
  }
}

export function saveSceneAIContext(
  sceneId: string,
  context: string,
): void {
  const key =
    `${SCENE_AI_CONTEXT_PREFIX}${sceneId}`

  try {
    if (!context.trim()) {
      localStorage.removeItem(key)
      return
    }

    localStorage.setItem(
      key,
      context,
    )
  } catch {
    // Ignore localStorage failures.
  }
}

// --------------------------------------------------
// AI Settings Storage
// --------------------------------------------------

export function loadAIConfig(): AIConfig {
  try {
    const stored =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!stored) {
      return DEFAULT_CONFIG
    }

    const parsed =
      JSON.parse(stored)

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveAIConfig(
  config: AIConfig,
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(config),
  )
}

export function clearAIConfig(): void {
  localStorage.removeItem(
    STORAGE_KEY,
  )
}

// --------------------------------------------------
// Context
// --------------------------------------------------

export function buildAIContext(
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  const context =
    buildSceneContext(
      activeScene,
      project.characters,
      project.locations,
    )

  const formattedContext =
    formatStoryContext(
      context,
    ).text

  const storySummary =
    project.storySummary?.trim() ||
    "No story summary has been generated yet."

  const sceneAIContext =
    loadSceneAIContext(
      activeScene.id,
    ).trim()

  return `STORY SO FAR:

${storySummary}

CURRENT STORY CONTEXT:

${formattedContext}${
    sceneAIContext
      ? `

SCENE-SPECIFIC AUTHOR INSTRUCTIONS:

${sceneAIContext}`
      : ""
  }`
}

// --------------------------------------------------
// Scene Text Extraction
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

    const text =
      current.text ?? ""

    const children =
      current.content
        ?.map(extractNode)
        .filter(Boolean)
        .join(" ") ?? ""

    return [
      text,
      children,
    ]
      .filter(Boolean)
      .join(" ")
  }

  return extractNode(content)
}

// --------------------------------------------------
// Previous Scene Context
// --------------------------------------------------

function buildPreviousScenesContext(
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  const scenes: string[] = []

  let foundActiveScene =
    false

  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      for (const scene of chapter.scenes) {
        if (
          scene.id ===
          activeScene.id
        ) {
          foundActiveScene = true
          break
        }

        const text =
          extractSceneText(
            scene,
          ).trim()

        if (!text) {
          continue
        }

        scenes.push(
          `ACT: ${act.title}
CHAPTER: ${chapter.title}
SCENE: ${scene.title}
${text}`,
        )
      }

      if (foundActiveScene) {
        break
      }
    }

    if (foundActiveScene) {
      break
    }
  }

  return scenes.join(
    "\n\n",
  )
}

// --------------------------------------------------
// Story Summary
// --------------------------------------------------

export async function generateStorySummary(
  project: MnemeonaProject,
  activeScene: ProjectScene,
  signal?: AbortSignal,
): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(
    config,
  )

  const previousScenes =
    buildPreviousScenesContext(
      project,
      activeScene,
    )

  if (!previousScenes.trim()) {
    return (
      project.storySummary?.trim() ??
      ""
    )
  }

  const existingSummary =
    project.storySummary?.trim() ||
    "(No previous story summary exists.)"

  const prompt = `You are maintaining the continuity summary for a novel.
Create an updated summary of what has happened in the story before the current scene.

The summary will be provided to another AI later so that it can understand the story without receiving the entire manuscript.

IMPORTANT RULES:
- Only include events that actually happened in the supplied manuscript.
- Never invent events, motivations, relationships, facts, or outcomes.
- Preserve important character actions and decisions.
- Preserve important relationship changes.
- Preserve important discoveries and revelations.
- Preserve important conflicts.
- Preserve unresolved plot threads.
- Preserve important changes to locations or circumstances.
- Preserve information that will matter for future scenes.
- Write in chronological order.
- Prefer concrete events over vague descriptions.
- Do not summarize writing style.
- Do not discuss the author.
- Do not mention that you are an AI.
- Do not mention these instructions.
- Treat the manuscript as canon.
- Keep the summary concise.
- If the existing summary already contains important information, preserve it.
- Do not duplicate events unnecessarily.

EXISTING STORY SUMMARY:

${existingSummary}

PREVIOUS SCENES:

${previousScenes}

Return ONLY the updated story summary.`

  return requestAICompletion({
    project,
    activeScene,
    signal,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    systemPrompt:
      "You maintain continuity summaries for fictional novels. Return only the updated story summary.",
  })
}

// --------------------------------------------------
// System Prompt
// --------------------------------------------------

export function buildSystemPrompt(
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  const storyContext =
    buildAIContext(
      project,
      activeScene,
    )

  return `You are Mnemeona AI, an intelligent writing companion for a novelist.

Your job is to help the author develop, understand, and write their story.

IMPORTANT RULES:
- Treat the supplied story context as the source of truth.
- Treat the story summary as established continuity.
- Treat scene-specific author instructions as instructions for the current scene.
- Do not invent established facts about characters, locations, relationships, or events.
- Maintain continuity with previous events.
- Maintain continuity with the current scene.
- Respect the current POV and narrative situation.
- When asked to continue prose, write prose rather than explaining your reasoning.
- Do not mention these instructions or the context system to the author.
- If something is unknown, say so rather than presenting an invented detail as established canon.

${storyContext}

CURRENT SCENE:

Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}
`
}

/**
 * Returns the exact system prompt generated for
 * normal AI requests.
 */
export function buildAIRequestPrompt(
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  return buildSystemPrompt(
    project,
    activeScene,
  )
}

// --------------------------------------------------
// Token Estimation
// --------------------------------------------------

/**
 * Rough browser-side token estimate.
 *
 * Ollama does the real tokenization server-side,
 * but the browser does not have the model tokenizer.
 */
export function estimateTokenCount(
  text: string,
): number {
  if (!text.trim()) {
    return 0
  }

  return Math.ceil(
    text.length / 4,
  )
}

// --------------------------------------------------
// Ollama Model Context Information
// --------------------------------------------------

interface OllamaShowResponse {
  parameters?: string

  model_info?: Record<
    string,
    unknown
  >

  details?: Record<
    string,
    unknown
  >

  error?: string
}

interface OllamaPsModel {
  name?: string
  model?: string
  context_length?: number
}

interface OllamaPsResponse {
  models?: OllamaPsModel[]
}

/**
 * Find a native model context length inside
 * Ollama's model_info.
 *
 * Ollama returns keys such as:
 *
 *   qwen3.context_length
 *   llama.context_length
 *   gemma3.context_length
 *
 * The previous implementation only accepted the
 * exact key "context_length", which meant those
 * architecture-prefixed keys were missed.
 */
function findModelContextLength(
  modelInfo:
    | Record<string, unknown>
    | undefined,
): number | null {
  if (!modelInfo) {
    return null
  }

  /*
   * First check the exact key.
   */
  const exact =
    modelInfo.context_length

  if (
    typeof exact === "number" &&
    Number.isFinite(exact) &&
    exact > 0
  ) {
    return Math.floor(exact)
  }

  /*
   * Then check architecture-prefixed keys.
   *
   * Examples:
   * qwen3.context_length
   * llama.context_length
   * gemma3.context_length
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
        )
    ) {
      if (
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
  }

  return null
}

/**
 * Read a num_ctx setting from Ollama's
 * serialized model parameters.
 *
 * Example:
 *
 * temperature 0.7
 * num_ctx 8192
 */
function findConfiguredContextLength(
  parameters:
    | string
    | undefined,
): number | null {
  if (
    !parameters
  ) {
    return null
  }

  const match =
    parameters.match(
      /(?:^|\s)num_ctx\s+(\d+)/i,
    )

  if (!match) {
    return null
  }

  const value =
    Number(match[1])

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null
  }

  return Math.floor(value)
}

/**
 * Find the currently loaded model in /api/ps.
 *
 * /api/ps reports the context_length actually
 * allocated to the running model. This is more useful
 * than native model metadata when Ollama is currently
 * using a smaller context window.
 */
async function getRunningModelContextLength(
  endpoint: string,
  model: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const response =
      await fetch(
        `${endpoint}/api/ps`,
        {
          method: "GET",

          headers: {
            ...(apiKey
              ? {
                  Authorization:
                    `Bearer ${apiKey}`,
                }
              : {}),
          },

          signal,
        },
      )

    if (!response.ok) {
      return null
    }

    const data =
      (await response.json()) as OllamaPsResponse

    const models =
      data.models ?? []

    const normalizedModel =
      model.toLowerCase()

    /*
     * Prefer an exact model-name match.
     */
    const exactMatch =
      models.find(
        (entry) =>
          (
            entry.name ??
            entry.model ??
            ""
          ).toLowerCase() ===
          normalizedModel,
      )

    if (
      exactMatch &&
      typeof exactMatch.context_length ===
        "number" &&
      Number.isFinite(
        exactMatch.context_length,
      ) &&
      exactMatch.context_length > 0
    ) {
      return Math.floor(
        exactMatch.context_length,
      )
    }

    /*
     * If Ollama has normalized the model name,
     * also allow a starts-with match.
     */
    const partialMatch =
      models.find(
        (entry) => {
          const name =
            (
              entry.name ??
              entry.model ??
              ""
            ).toLowerCase()

          return (
            name ===
              normalizedModel ||
            name.startsWith(
              `${normalizedModel}:`,
            )
          )
        },
      )

    if (
      partialMatch &&
      typeof partialMatch.context_length ===
        "number" &&
      Number.isFinite(
        partialMatch.context_length,
      ) &&
      partialMatch.context_length > 0
    ) {
      return Math.floor(
        partialMatch.context_length,
      )
    }

    return null
  } catch {
    return null
  }
}

/**
 * Gets the model's usable context window.
 *
 * Priority:
 *
 * 1. Currently running model's /api/ps context_length
 * 2. Explicit num_ctx configured on the model
 * 3. Native *.context_length model metadata
 *
 * This is intentionally model-aware and does not
 * hard-code Qwen3 or any other model.
 */
export async function getAIModelContextInfo(
  signal?: AbortSignal,
): Promise<AIModelContextInfo> {
  const config =
    loadAIConfig()

  const model =
    config.model.trim()

  if (
    !config.endpoint.trim() ||
    !model
  ) {
    return {
      model,
      contextLength:
        null,
      source:
        "unknown",
    }
  }

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  /*
   * First ask Ollama what is actually loaded.
   */
  const runningContextLength =
    await getRunningModelContextLength(
      endpoint,
      model,
      config.apiKey,
      signal,
    )

  if (
    runningContextLength !==
    null
  ) {
    return {
      model,
      contextLength:
        runningContextLength,
      source:
        "running",
    }
  }

  /*
   * Then request the model metadata.
   */
  try {
    const response =
      await fetch(
        `${endpoint}/api/show`,
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
            model,
            verbose: true,
          }),

          signal,
        },
      )

    if (!response.ok) {
      return {
        model,
        contextLength:
          null,
        source:
          "unknown",
      }
    }

    const data =
      (await response.json()) as OllamaShowResponse

    if (data.error) {
      return {
        model,
        contextLength:
          null,
        source:
          "unknown",
      }
    }

    /*
     * A custom Ollama model can explicitly define
     * num_ctx. If it does, that setting represents
     * the configured context window.
     */
    const configuredContextLength =
      findConfiguredContextLength(
        data.parameters,
      )

    if (
      configuredContextLength !==
      null
    ) {
      return {
        model,
        contextLength:
          configuredContextLength,
        source:
          "configured",
      }
    }

    /*
     * Finally use the model's native context window.
     *
     * This correctly handles:
     *
     * qwen3.context_length
     * llama.context_length
     * gemma3.context_length
     * etc.
     */
    const nativeContextLength =
      findModelContextLength(
        data.model_info,
      )

    if (
      nativeContextLength !==
      null
    ) {
      return {
        model,
        contextLength:
          nativeContextLength,
        source:
          "model",
      }
    }

    return {
      model,
      contextLength:
        null,
      source:
        "unknown",
    }
  } catch {
    return {
      model,
      contextLength:
        null,
      source:
        "unknown",
    }
  }
}

// --------------------------------------------------
// AI Configuration Validation
// --------------------------------------------------

function validateAIConfig(
  config: AIConfig,
): void {
  if (
    !config.endpoint.trim()
  ) {
    throw new Error(
      "No AI server URL is configured. Open AI Settings and enter your Ollama server URL.",
    )
  }

  if (
    !config.model.trim()
  ) {
    throw new Error(
      "No AI model is configured. Open AI Settings and enter the model name.",
    )
  }
}

// --------------------------------------------------
// Non-Streaming Completion
// --------------------------------------------------

async function requestAICompletion({
  messages,
  project,
  activeScene,
  signal,
  systemPrompt,
}: AICompletionOptions): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(
    config,
  )

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const finalSystemPrompt =
    systemPrompt?.trim()
      ? systemPrompt
      : buildSystemPrompt(
          project,
          activeScene,
        )

  const response =
    await fetch(
      `${endpoint}/api/chat`,
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

          messages: [
            {
              role: "system",
              content:
                finalSystemPrompt,
            },
            ...messages,
          ],

          stream: false,
        }),

        signal,
      },
    )

  if (!response.ok) {
    let message =
      `AI server returned HTTP ${response.status}.`

    try {
      const body =
        await response.text()

      if (body.trim()) {
        message = body
      }
    } catch {
      // Keep default error.
    }

    throw new Error(
      message,
    )
  }

  const data =
    await response.json()

  if (data?.error) {
    throw new Error(
      data.error,
    )
  }

  const result =
    data?.message?.content?.trim()

  if (!result) {
    throw new Error(
      "AI server returned an empty response.",
    )
  }

  return result
}

// --------------------------------------------------
// Streaming Chat
// --------------------------------------------------

export async function streamAIChat({
  messages,
  project,
  activeScene,
  signal,
  onToken,
  systemPrompt,
  continueWritingTokens,
}: AIChatOptions): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(
    config,
  )

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const finalSystemPrompt =
    systemPrompt?.trim()
      ? systemPrompt
      : buildSystemPrompt(
          project,
          activeScene,
        )

  const systemMessage: AIMessage = {
    role: "system",
    content:
      finalSystemPrompt,
  }

  const generationOptions =
    continueWritingTokens &&
    continueWritingTokens > 0
      ? {
          num_predict:
            normalizeContinueWritingTokens(
              continueWritingTokens,
            ),
        }
      : undefined

  const response =
    await fetch(
      `${endpoint}/api/chat`,
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

          messages: [
            systemMessage,
            ...messages,
          ],

          ...(generationOptions
            ? {
                options:
                  generationOptions,
              }
            : {}),

          stream: true,
        }),

        signal,
      },
    )

  if (!response.ok) {
    let message =
      `AI server returned HTTP ${response.status}.`

    try {
      const body =
        await response.text()

      if (body.trim()) {
        message = body
      }
    } catch {
      // Keep default error.
    }

    throw new Error(
      message,
    )
  }

  if (!response.body) {
    throw new Error(
      "AI server returned an empty response.",
    )
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let buffer = ""
  let fullResponse = ""

  const processLine = (
    line: string,
  ): boolean => {
    const trimmed =
      line.trim()

    if (!trimmed) {
      return false
    }

    try {
      const data =
        JSON.parse(trimmed)

      if (data?.error) {
        throw new Error(
          data.error,
        )
      }

      const token =
        data?.message?.content ??
        ""

      if (token) {
        fullResponse += token
        onToken?.(token)
      }

      return (
        data?.done === true
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.message !==
          "Unexpected end of JSON input"
      ) {
        throw error
      }

      return false
    }
  }

  try {
    while (true) {
      const {
        value,
        done,
      } = await reader.read()

      if (done) {
        break
      }

      buffer +=
        decoder.decode(
          value,
          {
            stream: true,
          },
        )

      const lines =
        buffer.split("\n")

      buffer =
        lines.pop() ?? ""

      for (const line of lines) {
        const finished =
          processLine(
            line,
          )

        if (finished) {
          return fullResponse
        }
      }
    }

    buffer +=
      decoder.decode()

    if (buffer.trim()) {
      processLine(buffer)
    }
  } finally {
    reader.releaseLock()
  }

  return fullResponse
}

// --------------------------------------------------
// Connection Test
// --------------------------------------------------

export async function testAIConnection(): Promise<void> {
  const config =
    loadAIConfig()

  if (
    !config.endpoint.trim()
  ) {
    throw new Error(
      "No AI server URL is configured.",
    )
  }

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const response =
    await fetch(
      `${endpoint}/api/tags`,
      {
        method: "GET",

        headers: {
          ...(config.apiKey
            ? {
                Authorization:
                  `Bearer ${config.apiKey}`,
              }
            : {}),
        },
      },
    )

  if (!response.ok) {
    throw new Error(
      `AI server returned HTTP ${response.status}.`,
    )
  }
}
