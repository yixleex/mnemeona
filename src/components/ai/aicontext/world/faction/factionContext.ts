import type { Character } from "@/types/character"
import type { Scene } from "@/types/manuscript"
import type { Faction } from "@/types/world/faction"
import type { Location } from "@/types/world/location"

import type {
  FactionMention,
} from "@/types/aicontext"

import {
  detectFactionMentions,
} from "./detectFactionMentions"

export interface FactionContext {
  factions: Faction[]

  detectedFactions: FactionMention[]
}

/**
 * Builds the faction-related AI context for a scene.
 *
 * A faction is relevant when:
 *
 * - Its name is mentioned.
 * - Its leader is mentioned.
 * - Its headquarters is mentioned.
 */
export function buildFactionContext(
  scene: Scene,
  factions: Faction[],
  characters: Character[],
  locations: Location[],
): FactionContext {
  const detectedFactions =
    detectFactionMentions(
      scene,
      factions,
      characters,
      locations,
    )

  const relevantFactionIds =
    new Set(
      detectedFactions.map(
        (mention) =>
          mention.factionId,
      ),
    )

  const relevantFactions =
    factions.filter(
      (faction) =>
        relevantFactionIds.has(
          faction.id,
        ),
    )

  return {
    factions:
      relevantFactions,

    detectedFactions,
  }
}
