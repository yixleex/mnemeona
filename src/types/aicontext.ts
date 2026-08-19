import type { Scene } from "./manuscript"
import type { Character } from "./character"
import type { Location } from "./world/location"
import type { WorldEvent } from "./world/event"
import type { Faction } from "./world/faction"
import type { Artifact } from "./world/artifact"

// --------------------------------------------------
// Character Mentions
// --------------------------------------------------

export interface CharacterMention {
  characterId: string

  matchedText: string

  confidence: number

  source: "name" | "alias"
}

// --------------------------------------------------
// Location Mentions
// --------------------------------------------------

export interface LocationMention {
  locationId: string

  matchedText: string

  confidence: number

  source: "name" | "alias"
}

// --------------------------------------------------
// World Event Mentions
// --------------------------------------------------

export interface WorldEventMention {
  eventId: string

  matchedText: string

  confidence: number

  source: "name"
}

// --------------------------------------------------
// Faction Mentions
// --------------------------------------------------

export interface FactionMention {
  factionId: string

  matchedText: string

  confidence: number

  source:
    | "name"
    | "leader"
    | "headquarters"
}

// --------------------------------------------------
// Artifact Mentions
// --------------------------------------------------

export interface ArtifactMention {
  artifactId: string

  matchedText: string

  confidence: number

  source: "name" | "alias"
}

// --------------------------------------------------
// Character Relationships
// --------------------------------------------------

export interface StoryContextRelationship {
  characterId: string

  relatedCharacterId: string

  type: string

  description: string
}

// --------------------------------------------------
// Structured Story Context
// --------------------------------------------------

export interface StoryContext {
  scene: Scene

  // Characters
  characters: Character[]

  detectedCharacters: CharacterMention[]

  relationships: StoryContextRelationship[]

  // Locations
  locations: Location[]

  detectedLocations: LocationMention[]

  // World Events
  events: WorldEvent[]

  detectedEvents: WorldEventMention[]

  // Factions
  factions: Faction[]

  detectedFactions: FactionMention[]

  // Artifacts
  artifacts: Artifact[]

  detectedArtifacts: ArtifactMention[]
}

// --------------------------------------------------
// Formatted Context
// --------------------------------------------------

export interface FormattedStoryContext {
  text: string

  characterCount: number

  detectedCharacterCount: number

  relationshipCount: number

  locationCount: number

  detectedLocationCount: number

  eventCount: number

  detectedEventCount: number

  factionCount: number

  detectedFactionCount: number

  artifactCount: number

  detectedArtifactCount: number

  estimatedTokens: number
}
