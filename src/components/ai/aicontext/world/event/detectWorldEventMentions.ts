import type { JSONContent } from "@tiptap/core"

import type { WorldEvent } from "@/types/world/event"
import type { Scene } from "@/types/manuscript"

import type { WorldEventMention } from "@/types/aicontext"

/**
 * Detects world event names and aliases mentioned
 * in the text of a scene.
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
    const candidates = [
      {
        text: event.name,
        source: "name" as const,
      },
      ...(event.aliases ?? []).map(
        (alias) => ({
          text: alias,
          source: "alias" as const,
        }),
      ),
    ]

    /*
     * Prevent the same event from being detected
     * multiple times if its name and/or aliases
     * are mentioned more than once.
     */
    let eventDetected = false

    for (const candidate of candidates) {
      const candidateText =
        candidate.text?.trim()

      if (!candidateText) {
        continue
      }

      const normalizedCandidate =
        normalizeText(
          candidateText,
        )

      if (!normalizedCandidate) {
        continue
      }

      if (
        containsPhrase(
          normalizedText,
          normalizedCandidate,
        )
      ) {
        mentions.push({
          eventId: event.id,

          matchedText:
            candidateText,

          confidence: 1,

          source:
            candidate.source,
        })

        eventDetected = true

        /*
         * Once the event has been detected,
         * there is no reason to check its other
         * aliases.
         */
        break
      }
    }

    if (eventDetected) {
      continue
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
 *
 * This is intentionally phrase-based so aliases
 * such as:
 *
 * "The Great War of 1247"
 *
 * are detected as a complete alias rather than
 * individual words.
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
