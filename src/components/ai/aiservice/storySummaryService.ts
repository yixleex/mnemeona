import type { MnemeonaProject } from "@/types/project"

import {
  loadAIConfig,
  streamAIChat,
  type AIMessage,
} from "./aiService"

// --------------------------------------------------
// Types
// --------------------------------------------------

export interface StorySummaryResult {
  text: string
  updatedAt: string
  generatedFromUpdatedAt: string
}

// --------------------------------------------------
// Build manuscript text
// --------------------------------------------------

function extractSceneText(
  project: MnemeonaProject,
): string {
  const sections: string[] = []

  for (const act of project.manuscript.acts) {
    sections.push(`ACT: ${act.title}`)

    for (const chapter of act.chapters) {
      sections.push(
        `CHAPTER: ${chapter.title}`,
      )

      for (const scene of chapter.scenes) {
        const text =
          extractTextFromJSON(
            scene.content,
          )

        if (!text.trim()) {
          continue
        }

        sections.push(
          [
            `SCENE: ${scene.title}`,

            scene.pov?.trim()
              ? `POV: ${scene.pov.trim()}`
              : "",

            scene.location?.trim()
              ? `LOCATION: ${scene.location.trim()}`
              : "",

            scene.time?.trim()
              ? `TIME: ${scene.time.trim()}`
              : "",

            scene.synopsis?.trim()
              ? `SYNOPSIS: ${scene.synopsis.trim()}`
              : "",

            "TEXT:",
            text,
          ]
            .filter(Boolean)
            .join("\n"),
        )
      }
    }
  }

  return sections.join(
    "\n\n",
  )
}

// --------------------------------------------------
// TipTap JSON → plain text
// --------------------------------------------------

function extractTextFromJSON(
  node: unknown,
): string {
  if (!node || typeof node !== "object") {
    return ""
  }

  const value =
    node as {
      type?: string
      text?: string
      content?: unknown[]
    }

  if (
    value.type === "text" &&
    typeof value.text === "string"
  ) {
    return value.text
  }

  if (!Array.isArray(value.content)) {
    return ""
  }

  return value.content
    .map((child) =>
      extractTextFromJSON(child),
    )
    .join(
      value.type === "paragraph" ||
        value.type === "heading"
        ? "\n"
        : "",
    )
}

// --------------------------------------------------
// Prompt
// --------------------------------------------------

function buildSummaryPrompt(
  project: MnemeonaProject,
  manuscriptText: string,
): string {
  const existingSummary =
    project.storySummary.trim()

  return `You are the story-memory system for Mnemeona, a novel-writing application.

Your task is to create a concise but information-dense summary of what has happened in the story so far.

The summary will be given to another AI later so that it can understand the novel without receiving the entire manuscript.

IMPORTANT RULES:

- Summarize established events only.
- Do not invent facts.
- Preserve important character motivations and changes.
- Preserve important relationships and conflicts.
- Preserve major discoveries and revelations.
- Preserve consequences of major events.
- Preserve important locations when relevant.
- Preserve unresolved mysteries, promises, conflicts, and plot threads.
- Track information that characters know or do not know when it matters.
- Do not write literary analysis.
- Do not critique the writing.
- Do not describe writing quality.
- Do not continue the story.
- Do not invent future events.
- Do not include unnecessary prose.
- Prefer concrete facts over vague descriptions.
- Keep the summary compact enough to fit into future AI prompts.

STRUCTURE THE SUMMARY LIKE THIS:

STORY SO FAR
A chronological summary of the major events.

CHARACTER DEVELOPMENTS
Important changes, motivations, discoveries, relationships, and conflicts.

IMPORTANT REVELATIONS
Facts that have been revealed to the reader or characters.

UNRESOLVED THREADS
Important mysteries, conflicts, promises, goals, or questions that remain unresolved.

CURRENT STATE
Where the story currently stands at the end of the supplied manuscript.

${
  existingSummary
    ? `
PREVIOUS SUMMARY:

${existingSummary}

Use the previous summary as a memory aid, but correct or update it whenever the manuscript contains newer or contradictory established information.
`
    : ""
}

MANUSCRIPT:

${manuscriptText}
`
}

// --------------------------------------------------
// Generate summary
// --------------------------------------------------

export async function generateStorySummary(
  project: MnemeonaProject,
): Promise<StorySummaryResult> {
  const config =
    loadAIConfig()

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

  const manuscriptText =
    extractSceneText(project)

  if (!manuscriptText.trim()) {
    return {
      text: "",
      updatedAt: new Date().toISOString(),
      generatedFromUpdatedAt:
        project.updatedAt,
    }
  }

  const messages: AIMessage[] = [
    {
      role: "user",
      content:
        buildSummaryPrompt(
          project,
          manuscriptText,
        ),
    },
  ]

  let generatedText = ""

  await streamAIChat({
    messages,
    project,
    /*
     * The summary service needs an active scene
     * for the current aiService API.
     *
     * We don't want the summary prompt to depend
     * on the active scene, so the current scene is
     * only used to satisfy the existing interface.
     */
    activeScene:
      findActiveScene(project),

    onToken: (token) => {
      generatedText += token
    },
  })

  const text =
    generatedText.trim()

  if (!text) {
    throw new Error(
      "The AI returned an empty story summary.",
    )
  }

  return {
    text,
    updatedAt:
      new Date().toISOString(),
    generatedFromUpdatedAt:
      project.updatedAt,
  }
}

// --------------------------------------------------
// Active scene helper
// --------------------------------------------------

function findActiveScene(
  project: MnemeonaProject,
) {
  const activeSceneId =
    project.settings.activeSceneId

  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      const scene =
        chapter.scenes.find(
          (candidate) =>
            candidate.id ===
            activeSceneId,
        )

      if (scene) {
        return scene
      }
    }
  }

  /*
   * If there is no active scene, use the
   * first available scene.
   */
  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      if (chapter.scenes.length > 0) {
        return chapter.scenes[0]
      }
    }
  }

  throw new Error(
    "Cannot generate a story summary because the project has no scenes.",
  )
}
