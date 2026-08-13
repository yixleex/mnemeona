import type { Location } from "@/types/location"
import type { Scene } from "@/types/manuscript"
import type { JSONContent } from "@tiptap/core"

import type { LocationMention } from "./locationContext"

/**
 * Detects location names mentioned in
 * the text of a scene.
 *
 * This does not modify the scene.
 * It only reports possible location references.
 */
export function detectLocationMentions(
  scene: Scene,
  locations: Location[],
): LocationMention[] {
  const text =
    extractSceneText(
      scene.content,
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

    if (
      containsPhrase(
        normalizedText,
        normalizeText(name),
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
 * from a Tiptap JSON document.
 */
function extractSceneText(
  content: JSONContent,
): string {
  const parts: string[] = []

  walkContent(
    content,
    parts,
  )

  return parts.join(" ")
}

function walkContent(
  node: JSONContent,
  parts: string[],
) {
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
 * "Blackwater Pass" matches:
 *
 * "They entered Blackwater Pass."
 *
 * but does not match:
 *
 * "Blackwater Passage"
 */
function containsPhrase(
  text: string,
  phrase: string,
): boolean {
  if (!phrase) {
    return false
  }

  const escaped =
    phrase.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    )

  const pattern =
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_]|['’]s\\b)`,
      "iu",
    )

  return pattern.test(text)
}
