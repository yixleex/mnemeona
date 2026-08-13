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

/*
 * We don't import Scene because your project types
 * don't export it directly.
 *
 * This extracts the actual scene type from the
 * existing MnemeonaProject structure.
 */
type ProjectScene =
  MnemeonaProject["manuscript"]["acts"][number]["chapters"][number]["scenes"][number]

export interface AIChatOptions {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  signal?: AbortSignal
  onToken?: (token: string) => void

  /*
   * Optional custom system prompt.
   *
   * If provided, this completely replaces the
   * automatically generated system prompt.
   */
  systemPrompt?: string

  /*
   * Maximum number of tokens the model should
   * generate for this response.
   */
  continueWritingTokens?: number
}

interface AICompletionOptions {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  signal?: AbortSignal
  systemPrompt?: string
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
      localStorage.getItem(STORAGE_KEY)

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

  return scenes.join("\n\n")
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

  validateAIConfig(config)

  const previousScenes =
    buildPreviousScenesContext(
      project,
      activeScene,
    )

  /*
   * There is nothing before the current scene.
   */
  if (!previousScenes.trim()) {
    return (
      project.storySummary?.trim() ?? ""
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

function buildSystemPrompt(
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

// --------------------------------------------------
// Shared AI Configuration Validation
// --------------------------------------------------

function validateAIConfig(
  config: AIConfig,
): void {
  if (!config.endpoint.trim()) {
    throw new Error(
      "No AI server URL is configured. Open AI Settings and enter your Ollama server URL.",
    )
  }

  if (!config.model.trim()) {
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

  validateAIConfig(config)

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
          model: config.model,

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

  validateAIConfig(config)

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

  /*
   * The UI value is already expressed in tokens,
   * so pass it directly to Ollama.
   *
   * No word/token conversion is performed.
   */
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
          model: config.model,

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

      return data?.done === true
    } catch (error) {
      /*
       * Ignore incomplete JSON fragments.
       * Actual server errors are still thrown.
       */
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

      buffer += decoder.decode(
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
          processLine(line)

        if (finished) {
          return fullResponse
        }
      }
    }

    /*
     * Flush any remaining decoder data.
     */
    buffer += decoder.decode()

    /*
     * Process the final buffered JSON object if
     * Ollama did not end it with a newline.
     */
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

  if (!config.endpoint.trim()) {
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
