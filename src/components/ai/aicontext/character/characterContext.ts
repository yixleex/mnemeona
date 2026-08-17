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
 * 3. One-level relationship targets belonging
 *    to relevant characters.
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

  /*
   * These are the characters that are directly
   * relevant to the scene.
   *
   * Relationship targets are intentionally NOT
   * added yet. We expand those one level below.
   */
  const directlyRelevantCharacterIds =
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

  /*
   * Expand the context by one relationship level.
   *
   * If a relevant character has a relationship
   * with another context-enabled character, include
   * that target character too.
   *
   * This allows:
   *
   *   Elara → Marcus
   *
   * to display Marcus even if Marcus himself was
   * not detected in the scene.
   *
   * We deliberately do NOT recursively follow
   * Marcus's relationships, which prevents a single
   * detected character from pulling in the entire cast.
   */
  const relevantCharacterIds =
    new Set(
      directlyRelevantCharacterIds,
    )

  for (const character of enabledCharacters) {
    if (
      !directlyRelevantCharacterIds.has(
        character.id,
      )
    ) {
      continue
    }

    for (const relationship of character.relationships) {
      if (
        enabledCharacters.some(
          (targetCharacter) =>
            targetCharacter.id ===
            relationship.targetCharacterId,
        )
      ) {
        relevantCharacterIds.add(
          relationship.targetCharacterId,
        )
      }
    }
  }

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
 * Finds relationships where BOTH characters
 * are relevant to the current scene.
 *
 * The relationship model stores:
 *
 *   character.id
 *     = source/owner of the relationship
 *
 *   relationship.targetCharacterId
 *     = character the relationship points to
 *
 * It is important that targetCharacterId is used
 * here rather than relationship.characterId.
 */
function buildRelevantRelationships(
  characters: Character[],
  relevantCharacterIds: Set<string>,
): StoryContextRelationship[] {
  const relationships: StoryContextRelationship[] =
    []

  for (const character of characters) {
    for (const relationship of character.relationships) {
      /*
       * Only include relationships whose target
       * character is also present in the AI context.
       *
       * This prevents unresolved UUIDs from appearing
       * in Formatted AI Context.
       */
      if (
        !relevantCharacterIds.has(
          relationship.targetCharacterId,
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
