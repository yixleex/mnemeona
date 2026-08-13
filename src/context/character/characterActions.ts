import type { Dispatch, SetStateAction } from "react"
import { createId } from "@/lib/project"
import type { MnemeonaProject } from "@/types/project"
import type {
  Character,
  CharacterRelationship,
} from "@/types/character"

type SetProject = Dispatch<
  SetStateAction<MnemeonaProject>
>

// --------------------------------------------------
// Characters
// --------------------------------------------------

export function addCharacter(
  setProject: SetProject,
) {
  const now =
    new Date().toISOString()

  const character: Character = {
    id: createId(),

    name: "New Character",

    aliases: [],

    role: "",

    summary: "",
    personality: "",
    appearance: "",
    background: "",

    goals: "",
    fears: "",
    motivations: "",

    relationships: [],

    notes: "",

    contextEnabled: true,

    createdAt: now,
    updatedAt: now,
  }

  setProject((current) => ({
    ...current,

    characters: [
      ...current.characters,
      character,
    ],

    updatedAt: now,
  }))

  return character.id
}

export function updateCharacter(
  setProject: SetProject,
  characterId: string,
  updates: Partial<Character>,
) {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    characters:
      current.characters.map(
        (character) =>
          character.id ===
          characterId
            ? {
                ...character,
                ...updates,
                updatedAt: now,
              }
            : character,
      ),

    updatedAt: now,
  }))
}

export function deleteCharacter(
  setProject: SetProject,
  characterId: string,
) {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    characters:
      current.characters.filter(
        (character) =>
          character.id !==
          characterId,
      ),

    updatedAt: now,
  }))
}

export function updateCharacterContext(
  setProject: SetProject,
  characterId: string,
  enabled: boolean,
) {
  updateCharacter(
    setProject,
    characterId,
    {
      contextEnabled: enabled,
    },
  )
}

// --------------------------------------------------
// Character Relationships
//
// characterId       = source/original character
// targetCharacterId = character being related to
// --------------------------------------------------

export function addCharacterRelationship(
  setProject: SetProject,
  characterId: string,
  targetCharacterId: string,
  type = "",
  description = "",
) {
  const now =
    new Date().toISOString()

  const relationship: CharacterRelationship =
    {
      id: createId(),

      // Source/original character
      characterId,

      // Target character
      targetCharacterId,

      type,
      description,
    }

  setProject((current) => ({
    ...current,

    characters:
      current.characters.map(
        (character) =>
          character.id ===
          characterId
            ? {
                ...character,

                relationships: [
                  ...character.relationships,
                  relationship,
                ],

                updatedAt: now,
              }
            : character,
      ),

    updatedAt: now,
  }))

  return relationship.id
}

export function updateCharacterRelationship(
  setProject: SetProject,
  characterId: string,
  relationshipId: string,
  updates: {
    targetCharacterId?: string
    type?: string
    description?: string
  },
) {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    characters:
      current.characters.map(
        (character) =>
          character.id ===
          characterId
            ? {
                ...character,

                relationships:
                  character.relationships.map(
                    (relationship) =>
                      relationship.id ===
                      relationshipId
                        ? {
                            ...relationship,
                            ...updates,
                          }
                        : relationship,
                  ),

                updatedAt: now,
              }
            : character,
      ),

    updatedAt: now,
  }))
}

export function deleteCharacterRelationship(
  setProject: SetProject,
  characterId: string,
  relationshipId: string,
) {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    characters:
      current.characters.map(
        (character) =>
          character.id ===
          characterId
            ? {
                ...character,

                relationships:
                  character.relationships.filter(
                    (relationship) =>
                      relationship.id !==
                      relationshipId,
                  ),

                updatedAt: now,
              }
            : character,
      ),

    updatedAt: now,
  }))
}
