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
}

interface AICompletionOptions {
  messages: AIMessage[]
  project: MnemeonaProject
  activeScene: ProjectScene
  signal?: AbortSignal
  systemPrompt?: string
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

  return `STORY SO FAR:

${storySummary}

CURRENT STORY CONTEXT:

${formattedContext}`
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
        if (scene.id === activeScene.id) {
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

/**
 * Generate a concise summary of everything that
 * happened before the current scene.
 *
 * This does NOT modify the project itself.
 *
 * The caller should save the returned summary into:
 *
 * project.storySummary
 */
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

    throw new Error(message)
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
}: AIChatOptions): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(config)

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  /*
   * Use the caller's custom system prompt when
   * provided. Otherwise use Mnemeona's normal
   * automatically generated story context.
   */
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

    throw new Error(message)
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
        const trimmed =
          line.trim()

        if (!trimmed) {
          continue
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

          if (data?.done) {
            return fullResponse
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message !==
              "Unexpected end of JSON input"
          ) {
            throw error
          }
        }
      }
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
