import type { Scene } from "./manuscript"
import type { Character } from "./character"
import type { Location } from "./world/location"
import type { WorldEvent } from "./world/event"

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

  estimatedTokens: number
}
