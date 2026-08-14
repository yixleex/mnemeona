import type { Location } from "@/types/world/location"
import type { Scene } from "@/types/manuscript"
import type { JSONContent } from "@tiptap/core"

import type { LocationMention } from "./locationContext"

/**
 * Detects location names mentioned in
 * the text of a scene.
 *
 * Detection searches both:
 *
 * 1. The actual scene manuscript text.
 * 2. The scene's Additional Context.
 *
 * This does not modify the scene.
 * It only reports possible location references.
 *
 * Detection is performed locally and synchronously.
 * No AI request is made.
 */
export function detectLocationMentions(
  scene: Scene,
  locations: Location[],
): LocationMention[] {
  const text =
    extractSceneText(
      scene.content,
      scene.aiAdditionalContext,
    )

  if (!text.trim()) {
    return []
  }

  const normalizedText =
    normalizeText(text)

  const mentions: LocationMention[] =
    []

  for (const location of locations) {
    const name =
      location.name.trim()

    if (!name) {
      continue
    }

    const normalizedName =
      normalizeText(name)

    if (
      !normalizedName
    ) {
      continue
    }

    if (
      containsPhrase(
        normalizedText,
        normalizedName,
      )
    ) {
      mentions.push({
        locationId:
          location.id,

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
 * Location matching is:
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
 * For example:
 *
 * "Blackwater Pass" matches:
 *
 * "They entered Blackwater Pass."
 *
 * but does not match:
 *
 * "They entered Blackwater Passage."
 *
 * It also handles punctuation and possessives:
 *
 * "Blackwater Pass's entrance"
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

  return pattern.test(
    text,
  )
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
