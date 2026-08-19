import {
  buildSceneContext,
  formatStoryContext,
} from "../aicontext/buildSceneContext"

import {
  buildNotesContext,
} from "../aicontext/buildNotesContext"

import type { MnemeonaProject } from "@/types/project"

// --------------------------------------------------
// Storage
// --------------------------------------------------

const STORAGE_KEY =
  "mnemeona-ai-settings"

const CONTINUE_WRITING_TOKENS_KEY =
  "mnemeona-ai-continue-writing-tokens"

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
  MnemeonaProject[
    "manuscript"
  ]["acts"][number]["chapters"][number]["scenes"][number]

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
  maxTokens?: number
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

export function normalizeContinueWritingTokens(
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
  const notesContext =
    buildNotesContext(
      project,
    )

  const context =
    buildSceneContext(
      activeScene,
      project.characters,
      project.locations,
      project.events,
      project.factions ?? [],
      project.artifacts ?? [],
    )

  const formattedContext =
    formatStoryContext(
      context,
    ).text

  const storySummary =
    project.storySummary?.trim() ||
    "No story summary has been generated yet."

  const sections: string[] = []

  /*
   * --------------------------------------------------
   * Persistent Notes
   * --------------------------------------------------
   *
   * These are author-controlled instructions/canon that
   * should remain available regardless of the current scene.
   */

  if (
    notesContext.trim()
  ) {
    sections.push(
      notesContext,
    )
  }

  /*
   * --------------------------------------------------
   * Story So Far
   * --------------------------------------------------
   *
   * This is generated continuity describing what has
   * actually happened in the manuscript.
   */

  sections.push(
    [
      "## Story So Far",
      "",
      storySummary,
    ].join("\n"),
  )

  /*
   * --------------------------------------------------
   * Current Story Context
   * --------------------------------------------------
   */

  sections.push(
    [
      "## Current Story Context",
      "",
      formattedContext,
    ].join("\n"),
  )

  return sections.join(
    "\n\n",
  )
}
// --------------------------------------------------
// Scene Text Extraction
// --------------------------------------------------

export function extractSceneText(
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

  return extractNode(
    content,
  )
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

  const config =
    loadAIConfig()

  validateAIConfig(config)

  const existingSummary =
    project.storySummary?.trim() ||
    "(No previous story summary exists.)"

  const prompt = `You are maintaining the continuity summary for a novel.

Create an updated summary of what has happened in the story BEFORE the current scene.

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
- Preserve important information from the existing summary.
- Do not duplicate events unnecessarily.

EXISTING STORY SUMMARY:

${existingSummary}

PREVIOUS SCENES:

${previousScenes}

Return ONLY the updated story summary.

Do not wrap the summary in quotes.
Do not use markdown headings.
Do not add commentary before or after the summary.`

  try {
    const result =
      await requestAICompletion({
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
        maxTokens: 2048,
      })

    const cleaned =
      cleanStorySummary(result)

    if (!cleaned) {
      throw new Error(
        "AI generated an empty story summary.",
      )
    }

    return cleaned
  } catch (error) {
    console.error(
      "Story summary generation failed:",
      error,
    )

    throw error
  }
}

// --------------------------------------------------
// Clean Story Summary
// --------------------------------------------------

function cleanStorySummary(
  value: string,
): string {
  let result =
    value.trim()

  if (!result) {
    return ""
  }

  result =
    result.replace(
      /^```(?:text|markdown)?\s*/i,
      "",
    )

  result =
    result.replace(
      /\s*```$/i,
      "",
    )

  return result.trim()
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
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}`
}

// --------------------------------------------------
// Exact Chat Messages
// --------------------------------------------------

export function buildAIChatMessages({
  messages,
  project,
  activeScene,
  systemPrompt,
}: {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  systemPrompt?: string
}): AIMessage[] {
  const finalSystemPrompt =
    systemPrompt?.trim()
      ? systemPrompt
      : buildSystemPrompt(
          project,
          activeScene,
        )

  return [
    {
      role: "system",
      content:
        finalSystemPrompt,
    },
    ...messages,
  ]
}

// --------------------------------------------------
// Shared AI Configuration Validation
// --------------------------------------------------

export function validateAIConfig(
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
  maxTokens,
}: AICompletionOptions): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(config)

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const finalMessages =
    buildAIChatMessages({
      messages,
      project,
      activeScene,
      systemPrompt,
    })

  const options =
    maxTokens &&
    maxTokens > 0
      ? {
          num_predict:
            maxTokens,
        }
      : undefined

  let response: Response

  try {
    response =
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
            messages:
              finalMessages,

            ...(options
              ? {
                  options,
                }
              : {}),

            stream: false,
          }),

          signal,
        },
      )
  } catch (error) {
    if (
      isAbortError(error) ||
      signal?.aborted
    ) {
      throw createAbortError()
    }

    throw new Error(
      `Unable to connect to the AI server at ${endpoint}. Make sure Ollama is running and the server is reachable.`,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    throw await createAIResponseError(
      response,
    )
  }

  let data: any

  try {
    data =
      await response.json()
  } catch (error) {
    throw new Error(
      "AI server returned invalid JSON.",
      {
        cause: error,
      },
    )
  }

  if (data?.error) {
    throw new Error(
      String(data.error),
    )
  }

  const result =
    typeof data?.message?.content ===
    "string"
      ? data.message.content.trim()
      : ""

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

  /*
   * If the caller already cancelled before the request
   * starts, fail immediately.
   */
  if (signal?.aborted) {
    throw createAbortError()
  }

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const finalMessages =
    buildAIChatMessages({
      messages,
      project,
      activeScene,
      systemPrompt,
    })

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

  let response: Response

  try {
    response =
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

            messages:
              finalMessages,

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
  } catch (error) {
    if (
      isAbortError(error) ||
      signal?.aborted
    ) {
      throw createAbortError()
    }

    throw new Error(
      `Unable to connect to the AI server at ${endpoint}. Make sure Ollama is running and the server is reachable.`,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    throw await createAIResponseError(
      response,
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
  let finished = false

  /*
   * Make sure the stream reader is cancelled if the
   * AbortController fires while reader.read() is waiting.
   *
   * This is the important part that makes Stop AI
   * responsive during an active Ollama stream.
   */
  let abortHandler:
    | (() => void)
    | undefined

  if (signal) {
    abortHandler = () => {
      void reader.cancel()
    }

    signal.addEventListener(
      "abort",
      abortHandler,
      {
        once: true,
      },
    )
  }

  const processLine = (
    line: string,
  ): boolean => {
    if (
      signal?.aborted
    ) {
      throw createAbortError()
    }

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
          String(data.error),
        )
      }

      const token =
        data?.message?.content ??
        ""

      if (token) {
        fullResponse += token
        onToken?.(token)
      }

      if (
        data?.done === true
      ) {
        finished = true
        return true
      }

      return false
    } catch (error) {
      if (
        isAbortError(error) ||
        signal?.aborted
      ) {
        throw createAbortError()
      }

      if (
        error instanceof Error &&
        error.message !==
          "Unexpected end of JSON input"
      ) {
        throw error
      }

      /*
       * Incomplete JSON is expected when a chunk ends
       * in the middle of a JSON object.
       */
      return false
    }
  }

  try {
    while (!finished) {
      if (
        signal?.aborted
      ) {
        throw createAbortError()
      }

      let readResult:
        | ReadableStreamReadResult<Uint8Array>

      try {
        readResult =
          await reader.read()
      } catch (error) {
        if (
          isAbortError(error) ||
          signal?.aborted
        ) {
          throw createAbortError()
        }

        throw error
      }

      const {
        value,
        done,
      } = readResult

      if (done) {
        break
      }

      if (
        signal?.aborted
      ) {
        throw createAbortError()
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

      for (
        const line of lines
      ) {
        if (
          processLine(line)
        ) {
          break
        }
      }
    }

    if (
      !finished &&
      buffer.trim()
    ) {
      processLine(buffer)
    }

    if (
      signal?.aborted
    ) {
      throw createAbortError()
    }

    return fullResponse
  } catch (error) {
    if (
      isAbortError(error) ||
      signal?.aborted
    ) {
      throw createAbortError()
    }

    throw error
  } finally {
    if (
      signal &&
      abortHandler
    ) {
      signal.removeEventListener(
        "abort",
        abortHandler,
      )
    }

    /*
     * Always release the reader lock.
     *
     * reader.cancel() may already have been called
     * by the AbortController, which is safe.
     */
    try {
      reader.releaseLock()
    } catch {
      // Reader was already released.
    }
  }
}

// --------------------------------------------------
// Abort Helpers
// --------------------------------------------------

function isAbortError(
  error: unknown,
): boolean {
  return (
    error instanceof DOMException &&
    error.name ===
      "AbortError"
  )
}

function createAbortError(): DOMException {
  return new DOMException(
    "AI generation was stopped.",
    "AbortError",
  )
}

// --------------------------------------------------
// AI HTTP Error
// --------------------------------------------------

async function createAIResponseError(
  response: Response,
): Promise<Error> {
  let message =
    `AI server returned HTTP ${response.status}.`

  try {
    const body =
      await response.text()

    if (body.trim()) {
      try {
        const parsed =
          JSON.parse(body)

        if (
          typeof parsed?.error ===
          "string"
        ) {
          message =
            parsed.error
        } else {
          message =
            body
        }
      } catch {
        message =
          body
      }
    }
  } catch {
    // Keep default error.
  }

  return new Error(
    message,
  )
}

// --------------------------------------------------
// Connection Test
// --------------------------------------------------

export async function testAIConnection(): Promise<void> {
  const config =
    loadAIConfig()

  validateAIConfig(config)

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  let response: Response

  try {
    response =
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
                role: "user",
                content:
                  "Reply with exactly: Mnemeona connection test successful.",
              },
            ],

            stream: false,
          }),
        },
      )
  } catch (error) {
    throw new Error(
      `Unable to connect to the AI server at ${endpoint}. Make sure Ollama is running and the server is reachable.`,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    throw await createAIResponseError(
      response,
    )
  }

  let data: any

  try {
    data =
      await response.json()
  } catch (error) {
    throw new Error(
      "The AI server returned an invalid response.",
      {
        cause: error,
      },
    )
  }

  if (data?.error) {
    throw new Error(
      String(data.error),
    )
  }

  const responseText =
    typeof data?.message?.content ===
    "string"
      ? data.message.content.trim()
      : ""

  if (!responseText) {
    throw new Error(
      "The AI server returned an empty response.",
    )
  }
}
