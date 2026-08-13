import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"
import type { Scene } from "@/types/manuscript"

import type {
  FormattedStoryContext,
  StoryContext,
} from "@/types/aicontext"

import {
  buildCharacterContext,
} from "./character/characterContext"

import {
  buildLocationContext,
} from "./world/location/locationContext"

/**
 * Builds the structured AI context for a scene.
 *
 * Each worldbuilding category is responsible
 * for building its own context.
 *
 * This function acts as the orchestrator.
 */
export function buildSceneContext(
  scene: Scene,
  characters: Character[],
  locations: Location[],
): StoryContext {
  const characterContext =
    buildCharacterContext(
      scene,
      characters,
    )

  const locationContext =
    buildLocationContext(
      scene,
      locations,
    )

  return {
    scene,

    characters:
      characterContext.characters,

    detectedCharacters:
      characterContext.detectedCharacters,

    relationships:
      characterContext.relationships,

    locations:
      locationContext.locations,

    detectedLocations:
      locationContext.detectedLocations,
  }
}

/**
 * Converts structured story context into
 * text suitable for an AI prompt.
 */
export function formatStoryContext(
  context: StoryContext,
): FormattedStoryContext {
  const sections: string[] = []

  sections.push(
    `## Current Scene\n${context.scene.title}`,
  )

  if (
    context.scene.pov?.trim()
  ) {
    sections.push(
      `## Point of View\n${context.scene.pov.trim()}`,
    )
  }

  if (
    context.scene.synopsis?.trim()
  ) {
    sections.push(
      `## Scene Synopsis\n${context.scene.synopsis.trim()}`,
    )
  }

  if (
    context.scene.location?.trim()
  ) {
    sections.push(
      `## Scene Location\n${context.scene.location.trim()}`,
    )
  }

  if (
    context.scene.time?.trim()
  ) {
    sections.push(
      `## Time\n${context.scene.time.trim()}`,
    )
  }

  // --------------------------------------------------
  // Locations
  // --------------------------------------------------

  if (
    context.locations.length > 0
  ) {
    const locationSections =
      context.locations.map(
        formatLocation,
      )

    sections.push(
      [
        "## Locations",

        "",

        locationSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  if (
    context.detectedLocations.length >
    0
  ) {
    const detectedSections =
      context.detectedLocations.map(
        (mention) =>
          `- ${mention.matchedText} (${mention.source})`,
      )

    sections.push(
      [
        "## Detected Location References",

        "",

        detectedSections.join(
          "\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // Characters
  // --------------------------------------------------

  if (
    context.characters.length > 0
  ) {
    const characterSections =
      context.characters.map(
        formatCharacter,
      )

    sections.push(
      [
        "## Characters Present",

        "",

        characterSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  if (
    context.detectedCharacters.length >
    0
  ) {
    const detectedSections =
      context.detectedCharacters.map(
        (mention) =>
          `- ${mention.matchedText} (${mention.source})`,
      )

    sections.push(
      [
        "## Detected Character References",

        "",

        detectedSections.join(
          "\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // Relationships
  // --------------------------------------------------

  if (
    context.relationships.length >
    0
  ) {
    const relationshipSections =
      context.relationships.map(
        (relationship) => {
          const character =
            context.characters.find(
              (item) =>
                item.id ===
                relationship.characterId,
            )

          const relatedCharacter =
            context.characters.find(
              (item) =>
                item.id ===
                relationship.relatedCharacterId,
            )

          const leftName =
            character?.name ??
            relationship.characterId

          const rightName =
            relatedCharacter?.name ??
            relationship.relatedCharacterId

          return [
            `### ${leftName} → ${rightName}`,

            `Type: ${relationship.type}`,

            `Description: ${relationship.description}`,
          ].join("\n")
        },
      )

    sections.push(
      [
        "## Character Relationships",

        "",

        relationshipSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  const text =
    sections.join("\n\n")

  return {
    text,

    characterCount:
      context.characters.length,

    detectedCharacterCount:
      context.detectedCharacters.length,

    relationshipCount:
      context.relationships.length,

    locationCount:
      context.locations.length,

    detectedLocationCount:
      context.detectedLocations.length,

    estimatedTokens:
      estimateTokens(text),
  }
}

/**
 * Formats an individual character.
 */
function formatCharacter(
  character: Character,
): string {
  const details: string[] = []

  details.push(
    `### ${character.name}`,
  )

  if (
    character.aliases.length >
    0
  ) {
    details.push(
      `Aliases: ${character.aliases.join(", ")}`,
    )
  }

  if (
    character.role?.trim()
  ) {
    details.push(
      `Role: ${character.role.trim()}`,
    )
  }

  addDetail(
    details,
    "Summary",
    character.summary,
  )

  addDetail(
    details,
    "Personality",
    character.personality,
  )

  addDetail(
    details,
    "Appearance",
    character.appearance,
  )

  addDetail(
    details,
    "Background",
    character.background,
  )

  addDetail(
    details,
    "Goals",
    character.goals,
  )

  addDetail(
    details,
    "Fears",
    character.fears,
  )

  addDetail(
    details,
    "Motivations",
    character.motivations,
  )

  addDetail(
    details,
    "Writer's Notes",
    character.notes,
  )

  return details.join("\n")
}

/**
 * Formats an individual location.
 */
function formatLocation(
  location: Location,
): string {
  const details: string[] = []

  details.push(
    `### ${location.name}`,
  )

  details.push(
    `Type: ${location.type}`,
  )

  addDetail(
    details,
    "Description",
    location.description,
  )

  addDetail(
    details,
    "Region",
    location.region,
  )

  addDetail(
    details,
    "Climate / Environment",
    location.climate,
  )

  addDetail(
    details,
    "Population",
    location.population,
  )

  addDetail(
    details,
    "Government / Control",
    location.government,
  )

  addDetail(
    details,
    "Significance",
    location.significance,
  )

  addDetail(
    details,
    "History",
    location.history,
  )

  addDetail(
    details,
    "Secrets",
    location.secrets,
  )

  return details.join("\n")
}

function addDetail(
  sections: string[],
  label: string,
  value?: string,
) {
  if (!value?.trim()) {
    return
  }

  sections.push(
    `**${label}:**\n${value.trim()}`,
  )
}

/**
 * Rough token estimation.
 *
 * Actual token counts depend on the model
 * and tokenizer being used.
 */
function estimateTokens(
  text: string,
): number {
  if (!text.trim()) {
    return 0
  }

  return Math.ceil(
    text.length / 4,
  )
}
