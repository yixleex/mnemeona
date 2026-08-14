import type { Character } from "@/types/character"
import type { Scene } from "@/types/manuscript"
import type { CharacterMention } from "@/types/aicontext"

import type { JSONContent } from "@tiptap/core"

/**
 * Detects character names and aliases mentioned
 * in the text of a scene.
 *
 * Detection searches both:
 *
 * 1. The actual scene manuscript text.
 * 2. The scene's Additional Context.
 *
 * This does not modify the scene or characterIds.
 * It only reports possible character references.
 */
export function detectCharacterMentions(
  scene: Scene,
  characters: Character[],
): CharacterMention[] {
  const text = extractSceneText(
    scene.content,
    scene.aiAdditionalContext,
  )

  if (!text.trim()) {
    return []
  }

  const normalizedText =
    normalizeText(text)

  const mentions: CharacterMention[] = []

  for (const character of characters) {
    if (!character.contextEnabled) {
      continue
    }

    const names = [
      {
        value: character.name,
        source: "name" as const,
      },
      ...character.aliases.map(
        (alias) => ({
          value: alias,
          source: "alias" as const,
        }),
      ),
    ]

    for (const name of names) {
      const value =
        name.value.trim()

      if (!value) {
        continue
      }

      if (
        containsPhrase(
          normalizedText,
          normalizeText(value),
        )
      ) {
        mentions.push({
          characterId: character.id,
          matchedText: value,
          confidence:
            name.source === "name"
              ? 1
              : 0.9,
          source: name.source,
        })

        /*
         * We only need one match per character
         * for the context layer.
         */
        break
      }
    }
  }

  return mentions
}

/**
 * Recursively extracts readable text from
 * a Tiptap JSON document and combines it with
 * Additional Context.
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
) {
  if (typeof node.text === "string") {
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
 * This makes matching case-insensitive and
 * removes unnecessary whitespace.
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
 * Matches a phrase as a whole phrase rather than
 * matching it inside another word.
 *
 * Example:
 *
 * "Elara" matches:
 * "Elara walked outside."
 *
 * but does not match:
 * "Elara's"
 *
 * The apostrophe case is handled separately
 * below.
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
