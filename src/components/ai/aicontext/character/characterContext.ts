import type { Character } from "@/types/character"
import type { Scene } from "@/types/manuscript"
import type {
  CharacterMention,
  StoryContextRelationship,
} from "@/types/aicontext"

import { detectCharacterMentions } from "./detectCharacterMentions"

export interface CharacterContext {
  characters: Character[]
  detectedCharacters: CharacterMention[]
  relationships: StoryContextRelationship[]
}

/**
 * Builds the character-related AI context
 * for a scene.
 *
 * Character relevance comes from:
 *
 * 1. Characters explicitly assigned to the scene.
 * 2. Characters detected in the scene text.
 *
 * Automatic detection never modifies
 * scene.characterIds.
 */
export function buildCharacterContext(
  scene: Scene,
  characters: Character[],
): CharacterContext {
  const enabledCharacters =
    characters.filter(
      (character) =>
        character.contextEnabled,
    )

  const explicitCharacters =
    enabledCharacters.filter(
      (character) =>
        scene.characterIds.includes(
          character.id,
        ),
    )

  const detectedCharacters =
    detectCharacterMentions(
      scene,
      enabledCharacters,
    )

  const relevantCharacterIds =
    new Set([
      ...explicitCharacters.map(
        (character) =>
          character.id,
      ),

      ...detectedCharacters.map(
        (mention) =>
          mention.characterId,
      ),
    ])

  const relevantCharacters =
    enabledCharacters.filter(
      (character) =>
        relevantCharacterIds.has(
          character.id,
        ),
    )

  const relationships =
    buildRelevantRelationships(
      relevantCharacters,
      relevantCharacterIds,
    )

  return {
    characters:
      relevantCharacters,

    detectedCharacters,

    relationships,
  }
}

/**
 * Finds relationships where both characters
 * are relevant to the current scene.
 */
function buildRelevantRelationships(
  characters: Character[],
  relevantCharacterIds: Set<string>,
): StoryContextRelationship[] {
  const relationships: StoryContextRelationship[] =
    []

  for (const character of characters) {
    for (const relationship of character.relationships) {
      if (
        !relevantCharacterIds.has(
          relationship.characterId,
        )
      ) {
        continue
      }

      relationships.push({
        characterId:
          character.id,

        relatedCharacterId:
          relationship.targetCharacterId,

        type:
          relationship.type,

        description:
          relationship.description,
      })
    }
  }

  return relationships
}
