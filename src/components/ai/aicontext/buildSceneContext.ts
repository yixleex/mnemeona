import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"
import type { WorldEvent } from "@/types/world/event"
import type { Faction } from "@/types/world/faction"
import type { Artifact } from "@/types/world/artifact"
import type { Lore } from "@/types/world/lore"
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

import {
  buildWorldEventContext,
} from "./world/event/worldEventContext"

import {
  buildFactionContext,
} from "./world/faction/factionContext"

import {
  buildArtifactContext,
} from "./world/artifact/artifactContext"

import {
  detectLoreMentions,
} from "./world/lore/detectLoreMentions"

/**
 * Builds the structured AI context for a scene.
 *
 * Each worldbuilding category is responsible
 * for building its own context.
 *
 * This function acts as the orchestrator.
 *
 * Persistent project notes are deliberately NOT
 * handled here.
 */
export function buildSceneContext(
  scene: Scene,
  characters: Character[],
  locations: Location[],
  events: WorldEvent[],
  factions: Faction[] = [],
  artifacts: Artifact[] = [],
  loreEntries: Lore[] = [],
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

  const eventContext =
    buildWorldEventContext(
      scene,
      events,
    )

  const factionContext =
    buildFactionContext(
      scene,
      factions,
      characters,
      locations,
    )

  const artifactContext =
    buildArtifactContext(
      scene,
      artifacts,
    )

  /*
   * Lore is detected from the scene's searchable text.
   *
   * We intentionally include the same scene fields that
   * are useful for the other worldbuilding detectors.
   *
   * This allows lore to be recognized when it appears in:
   * - the manuscript text
   * - synopsis
   * - additional AI context
   * - POV
   * - location
   * - time
   */
  const loreSearchText = [
    scene.title,
    scene.content,
    scene.synopsis,
    scene.aiAdditionalContext,
    scene.pov,
    scene.location,
    scene.time,
  ]
    .filter(
      (
        value,
      ): value is string =>
        typeof value === "string" &&
        value.trim().length > 0,
    )
    .join("\n")

  const detectedLore =
    detectLoreMentions(
      loreSearchText,
      loreEntries,
    )

  /*
   * Only include lore entries that were actually
   * detected in the scene.
   *
   * This keeps the AI context focused instead of
   * sending the entire world's lore database.
   */
  const relevantLore =
    detectedLore
      .map((mention) =>
        loreEntries.find(
          (lore) =>
            lore.id ===
            mention.loreId,
        ),
      )
      .filter(
        (
          lore,
        ): lore is Lore =>
          Boolean(lore),
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

    events:
      eventContext.events,

    detectedEvents:
      eventContext.detectedEvents,

    factions:
      factionContext.factions,

    detectedFactions:
      factionContext.detectedFactions,

    artifacts:
      artifactContext.artifacts,

    detectedArtifacts:
      artifactContext.detectedArtifacts,

    lore:
      relevantLore,

    detectedLore,
  }
}

/**
 * Converts structured story context into
 * text suitable for an AI prompt.
 *
 * Detection results determine which
 * worldbuilding records become relevant.
 */
export function formatStoryContext(
  context: StoryContext,
): FormattedStoryContext {
  const sections: string[] = []

  // --------------------------------------------------
  // Current Scene
  // --------------------------------------------------

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
  // Additional Context
  // --------------------------------------------------

  if (
    context.scene.aiAdditionalContext?.trim()
  ) {
    sections.push(
      [
        "## Additional Scene Context",
        "",
        context.scene.aiAdditionalContext.trim(),
      ].join("\n"),
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

  // --------------------------------------------------
  // World Events
  // --------------------------------------------------

  if (
    context.events.length > 0
  ) {
    const eventSections =
      context.events.map(
        formatWorldEvent,
      )

    sections.push(
      [
        "## World Events",
        "",
        eventSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // Factions
  // --------------------------------------------------

  if (
    context.factions.length > 0
  ) {
    const factionSections =
      context.factions.map(
        (faction) =>
          formatFaction(
            faction,
            context,
          ),
      )

    sections.push(
      [
        "## Factions",
        "",
        factionSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // Artifacts
  // --------------------------------------------------

  if (
    context.artifacts.length > 0
  ) {
    const artifactSections =
      context.artifacts.map(
        (artifact) =>
          formatArtifact(
            artifact,
            context,
          ),
      )

    sections.push(
      [
        "## Artifacts",
        "",
        artifactSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // World Lore
  // --------------------------------------------------

  if (
    context.lore.length > 0
  ) {
    const loreSections =
      context.lore.map(
        formatLore,
      )

    sections.push(
      [
        "## World Lore",
        "",
        loreSections.join(
          "\n\n",
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
        "## Characters",
        "",
        characterSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  // --------------------------------------------------
  // Relationships
  // --------------------------------------------------

  if (
    context.relationships.length > 0
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
    sections.join(
      "\n\n",
    )

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

    eventCount:
      context.events.length,

    detectedEventCount:
      context.detectedEvents.length,

    factionCount:
      context.factions.length,

    detectedFactionCount:
      context.detectedFactions.length,

    artifactCount:
      context.artifacts.length,

    detectedArtifactCount:
      context.detectedArtifacts.length,

    loreCount:
      context.lore.length,

    detectedLoreCount:
      context.detectedLore.length,

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

  if (
    character.age?.trim()
  ) {
    details.push(
      `Age: ${character.age.trim()}`,
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

/**
 * Formats an individual world event.
 */
function formatWorldEvent(
  event: WorldEvent,
): string {
  const details: string[] = []

  details.push(
    `### ${event.name}`,
  )

  details.push(
    `Type: ${event.type}`,
  )

  addDetail(
    details,
    "Description",
    event.description,
  )

  addDetail(
    details,
    "Date",
    event.date,
  )

  addDetail(
    details,
    "Significance",
    event.significance,
  )

  addDetail(
    details,
    "History",
    event.history,
  )

  addDetail(
    details,
    "Consequences",
    event.consequences,
  )

  addDetail(
    details,
    "Secrets",
    event.secrets,
  )

  return details.join("\n")
}

/**
 * Formats an individual faction.
 */
function formatFaction(
  faction: Faction,
  context: StoryContext,
): string {
  const details: string[] = []

  details.push(
    `### ${faction.name}`,
  )

  details.push(
    `Type: ${faction.type}`,
  )

  addDetail(
    details,
    "Description",
    faction.description,
  )

  if (
    faction.leaderCharacterId
  ) {
    const leader =
      context.characters.find(
        (character) =>
          character.id ===
          faction.leaderCharacterId,
      )

    if (leader) {
      details.push(
        `Leader: ${leader.name}`,
      )
    }
  }

  if (
    faction.headquartersLocationId
  ) {
    const headquarters =
      context.locations.find(
        (location) =>
          location.id ===
          faction.headquartersLocationId,
      )

    if (headquarters) {
      details.push(
        `Headquarters: ${headquarters.name}`,
      )
    }
  }

  addDetail(
    details,
    "Goals",
    faction.goals,
  )

  addDetail(
    details,
    "Values",
    faction.values,
  )

  addDetail(
    details,
    "Resources",
    faction.resources,
  )

  addDetail(
    details,
    "Allies",
    faction.allies,
  )

  addDetail(
    details,
    "Enemies",
    faction.enemies,
  )

  addDetail(
    details,
    "History",
    faction.history,
  )

  addDetail(
    details,
    "Secrets",
    faction.secrets,
  )

  return details.join("\n")
}

/**
 * Formats an individual artifact.
 *
 * Aliases are deliberately included so the AI understands
 * that multiple names refer to the same object.
 */
function formatArtifact(
  artifact: Artifact,
  context: StoryContext,
): string {
  const details: string[] = []

  details.push(
    `### ${artifact.name}`,
  )

  if (
    artifact.aliases?.length > 0
  ) {
    details.push(
      `Aliases: ${artifact.aliases.join(", ")}`,
    )
  }

  details.push(
    `Type: ${artifact.type}`,
  )

  addDetail(
    details,
    "Description",
    artifact.description,
  )

  if (
    artifact.ownerCharacterId
  ) {
    const owner =
      context.characters.find(
        (character) =>
          character.id ===
          artifact.ownerCharacterId,
      )

    if (owner) {
      details.push(
        `Current Owner: ${owner.name}`,
      )
    }
  }

  if (
    artifact.locationId
  ) {
    const location =
      context.locations.find(
        (location) =>
          location.id ===
          artifact.locationId,
      )

    if (location) {
      details.push(
        `Location: ${location.name}`,
      )
    }
  }

  addDetail(
    details,
    "Powers",
    artifact.powers,
  )

  addDetail(
    details,
    "Abilities",
    artifact.abilities,
  )

  addDetail(
    details,
    "Appearance",
    artifact.appearance,
  )

  addDetail(
    details,
    "History",
    artifact.history,
  )

  addDetail(
    details,
    "Significance",
    artifact.significance,
  )

  addDetail(
    details,
    "Secrets",
    artifact.secrets,
  )

  return details.join("\n")
}

/**
 * Formats an individual piece of world lore.
 */
function formatLore(
  lore: Lore,
): string {
  const details: string[] = []

  details.push(
    `### ${lore.name}`,
  )

  if (
    lore.aliases?.length > 0
  ) {
    details.push(
      `Aliases: ${lore.aliases.join(", ")}`,
    )
  }

  details.push(
    `Type: ${lore.type}`,
  )

  addDetail(
    details,
    "Description",
    lore.description,
  )

  addDetail(
    details,
    "Origins",
    lore.origins,
  )

  addDetail(
    details,
    "Beliefs",
    lore.beliefs,
  )

  addDetail(
    details,
    "Significance",
    lore.significance,
  )

  addDetail(
    details,
    "History",
    lore.history,
  )

  addDetail(
    details,
    "Truth",
    lore.truth,
  )

  addDetail(
    details,
    "Secrets",
    lore.secrets,
  )

  return details.join("\n")
}

/**
 * Adds an optional text field to a formatted section.
 */
function addDetail(
  details: string[],
  label: string,
  value?: string,
): void {
  if (
    value?.trim()
  ) {
    details.push(
      `${label}: ${value.trim()}`,
    )
  }
}

/**
 * Very rough token estimation.
 *
 * This is intentionally approximate and is only
 * used for displaying context size information.
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
