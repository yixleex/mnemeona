import type { JSONContent } from "@tiptap/core"

import type { Scene } from "@/types/manuscript"
import type { Faction } from "@/types/world/faction"

import type {
  FactionMention,
} from "@/types/aicontext"

import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"

/**
 * Detects faction references in a scene.
 *
 * A faction can be detected through:
 *
 * - Its own name
 * - Its leader's character name
 * - Its headquarters' location name
 *
 * This allows the AI context to recognize a faction
 * even when the faction itself isn't explicitly named.
 */
export function detectFactionMentions(
  scene: Scene,
  factions: Faction[],
  characters: Character[] = [],
  locations: Location[] = [],
): FactionMention[] {
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

  const mentions: FactionMention[] =
    []

  for (const faction of factions) {
    const factionName =
      faction.name.trim()

    if (
      factionName &&
      containsPhrase(
        normalizedText,
        normalizeText(
          factionName,
        ),
      )
    ) {
      mentions.push({
        factionId:
          faction.id,

        matchedText:
          factionName,

        confidence: 1,

        source: "name",
      })

      continue
    }

    if (
      faction.leaderCharacterId
    ) {
      const leader =
        characters.find(
          (character) =>
            character.id ===
            faction.leaderCharacterId,
        )

      if (
        leader &&
        containsPhrase(
          normalizedText,
          normalizeText(
            leader.name,
          ),
        )
      ) {
        mentions.push({
          factionId:
            faction.id,

          matchedText:
            leader.name,

          confidence: 0.95,

          source: "leader",
        })

        continue
      }

      /*
       * Also check character aliases.
       */
      if (leader) {
        const matchedAlias =
          leader.aliases.find(
            (alias) =>
              alias.trim() &&
              containsPhrase(
                normalizedText,
                normalizeText(alias),
              ),
          )

        if (matchedAlias) {
          mentions.push({
            factionId:
              faction.id,

            matchedText:
              matchedAlias,

            confidence: 0.9,

            source: "leader",
          })

          continue
        }
      }
    }

    if (
      faction.headquartersLocationId
    ) {
      const headquarters =
        locations.find(
          (location) =>
            location.id ===
            faction.headquartersLocationId,
        )

      if (
        headquarters &&
        containsPhrase(
          normalizedText,
          normalizeText(
            headquarters.name,
          ),
        )
      ) {
        mentions.push({
          factionId:
            faction.id,

          matchedText:
            headquarters.name,

          confidence: 0.9,

          source:
            "headquarters",
        })
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
