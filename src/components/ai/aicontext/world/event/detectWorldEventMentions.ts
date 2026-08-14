import type { JSONContent } from "@tiptap/core"

import type { WorldEvent } from "@/types/world/event"
import type { Scene } from "@/types/manuscript"

import type { WorldEventMention } from "@/types/aicontext"

/**
 * Detects world event names mentioned in
 * the text of a scene.
 *
 * Detection searches both:
 *
 * 1. The actual scene manuscript text.
 * 2. The scene's Additional Context.
 *
 * This does not modify the scene.
 * It only reports possible world event references.
 *
 * Detection is performed locally and synchronously.
 * No AI request is made.
 */
export function detectWorldEventMentions(
  scene: Scene,
  events: WorldEvent[],
): WorldEventMention[] {
  const text = extractSceneText(
    scene.content,
    scene.aiAdditionalContext,
  )

  if (!text.trim()) {
    return []
  }

  const normalizedText =
    normalizeText(text)

  const mentions: WorldEventMention[] =
    []

  for (const event of events) {
    const name =
      event.name.trim()

    if (!name) {
      continue
    }

    const normalizedName =
      normalizeText(name)

    if (!normalizedName) {
      continue
    }

    if (
      containsPhrase(
        normalizedText,
        normalizedName,
      )
    ) {
      mentions.push({
        eventId:
          event.id,

        matchedText:
          name,

        confidence: 1,

        source: "name",
      })
    }
  }

  return mentions
}

/**
 * Recursively extracts readable text
 * from a Tiptap JSON document and combines it
 * with Additional Context.
 */
function extractSceneText(
  content: JSONContent,
  additionalContext?: string,
): string {
  const parts: string[] = []

  walkContent(
    content,
    parts,
  )

  if (
    additionalContext?.trim()
  ) {
    parts.push(
      additionalContext.trim(),
    )
  }

  return parts.join(" ")
}

function walkContent(
  node: JSONContent,
  parts: string[],
): void {
  if (
    typeof node.text ===
    "string"
  ) {
    parts.push(node.text)
  }

  if (!node.content) {
    return
  }

  for (const child of node.content) {
    walkContent(
      child,
      parts,
    )
  }
}

/**
 * Normalizes text before matching.
 *
 * World event matching is:
 * - case-insensitive
 * - whitespace-insensitive
 */
function normalizeText(
  text: string,
): string {
  return text
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Matches a phrase as a whole phrase.
 */
function containsPhrase(
  text: string,
  phrase: string,
): boolean {
  if (!phrase) {
    return false
  }

  const escaped =
    escapeRegExp(
      phrase,
    )

  const pattern =
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_]|['’]s\\b)`,
      "iu",
    )

  return pattern.test(text)
}

/**
 * Escapes a string so it can safely be
 * inserted into a regular expression.
 */
function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  )
}
