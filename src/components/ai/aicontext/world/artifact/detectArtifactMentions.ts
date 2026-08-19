import type { JSONContent } from "@tiptap/core"

import type { Scene } from "@/types/manuscript"
import type { Artifact } from "@/types/world/artifact"

import type {
  ArtifactMention,
} from "@/types/aicontext"

/**
 * Detects artifact references in a scene.
 *
 * An artifact can be detected through:
 *
 * - Its canonical name
 * - Any of its aliases
 *
 * Matching is case-insensitive and respects word boundaries,
 * so an artifact named "Sun" does not accidentally match
 * "Sunday".
 */
export function detectArtifactMentions(
  scene: Scene,
  artifacts: Artifact[] = [],
): ArtifactMention[] {
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

  const mentions: ArtifactMention[] =
    []

  for (const artifact of artifacts) {
    const names = [
      artifact.name,
      ...(artifact.aliases ?? []),
    ]

    const seenNames =
      new Set<string>()

    for (const rawName of names) {
      const name =
        rawName.trim()

      if (!name) {
        continue
      }

      const normalizedName =
        normalizeText(name)

      if (
        !normalizedName ||
        seenNames.has(
          normalizedName,
        )
      ) {
        continue
      }

      seenNames.add(
        normalizedName,
      )

      if (
        containsPhrase(
          normalizedText,
          normalizedName,
        )
      ) {
        const isCanonicalName =
          normalizeText(
            artifact.name,
          ) === normalizedName

        mentions.push({
          artifactId:
            artifact.id,

          matchedText:
            name,

          confidence:
            isCanonicalName
              ? 1
              : 0.95,

          source:
            isCanonicalName
              ? "name"
              : "alias",
        })

        /*
         * One mention per artifact is enough for determining
         * relevance. We do not need to add the same artifact
         * repeatedly if several aliases appear.
         */
        break
      }
    }
  }

  return mentions
}

/**
 * Recursively extracts readable text from a Tiptap JSON document
 * and combines it with Additional Context.
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

function normalizeText(
  text: string,
): string {
  return text
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

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
