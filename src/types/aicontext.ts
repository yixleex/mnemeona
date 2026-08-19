/**
 * Types used by the AI context system.
 *
 * World Lore is treated as a first-class world entity alongside
 * characters, locations, artifacts, etc.
 */

export type AIContextEntityType =
  | "character"
  | "location"
  | "artifact"
  | "lore"
  | "world-lore"
  | "faction"
  | "event"
  | "other"

export interface AIContextEntity {
  id: string
  type: AIContextEntityType
  name: string

  /**
   * Alternative names the AI should recognize as references
   * to this entity.
   */
  aliases?: string[]

  /**
   * Human-readable content used when building AI context.
   */
  content?: string

  /**
   * Optional relevance/search metadata.
   */
  description?: string

  /**
   * Additional data specific to the source entity.
   */
  metadata?: Record<string, unknown>
}

/**
 * A piece of world lore that can be supplied to the AI.
 */
export interface AIContextLore {
  id: string
  type: "lore" | "world-lore"
  name: string
  aliases?: string[]

  /**
   * Main lore text.
   */
  content: string

  /**
   * Optional short description/summary.
   */
  description?: string

  /**
   * Optional lore category, such as:
   * - History
   * - Religion
   * - Magic
   * - Culture
   * - Politics
   * - Geography
   * - Mythology
   * - Technology
   * - Other
   */
  category?: string

  createdAt?: string
  updatedAt?: string

  metadata?: Record<string, unknown>
}

/**
 * An artifact represented in AI context.
 */
export interface AIContextArtifact {
  id: string
  type: "artifact"
  name: string
  aliases?: string[]

  description?: string
  artifactType?: string

  ownerCharacterId?: string
  ownerName?: string

  locationId?: string
  locationName?: string

  powers?: string
  abilities?: string
  appearance?: string
  history?: string
  significance?: string
  secrets?: string

  createdAt?: string
  updatedAt?: string

  metadata?: Record<string, unknown>
}

/**
 * A character represented in AI context.
 */
export interface AIContextCharacter {
  id: string
  type: "character"
  name: string
  aliases?: string[]

  description?: string

  metadata?: Record<string, unknown>
}

/**
 * A location represented in AI context.
 */
export interface AIContextLocation {
  id: string
  type: "location"
  name: string
  aliases?: string[]

  description?: string

  metadata?: Record<string, unknown>
}

/**
 * Context source used by the AI context builder.
 */
export type AIContextItem =
  | AIContextEntity
  | AIContextCharacter
  | AIContextLocation
  | AIContextArtifact
  | AIContextLore

/**
 * Collection of world information available to the AI.
 */
export interface AIContext {
  characters?: AIContextCharacter[]
  locations?: AIContextLocation[]
  artifacts?: AIContextArtifact[]
  lore?: AIContextLore[]

  /**
   * Generic entities allow future world database types
   * to be included without changing this interface.
   */
  entities?: AIContextEntity[]

  /**
   * Optional assembled text representation.
   */
  text?: string
}

/**
 * Options controlling how context is generated.
 */
export interface AIContextOptions {
  includeCharacters?: boolean
  includeLocations?: boolean
  includeArtifacts?: boolean
  includeLore?: boolean
  includeWorldLore?: boolean

  /**
   * Maximum number of context entries to include.
   */
  maxItems?: number

  /**
   * Optional search/reference text used for relevance filtering.
   */
  query?: string
}

/**
 * A generic reference discovered in user/story text.
 *
 * This is particularly useful for aliases:
 *
 *   Artifact: "The Crown of Ashes"
 *   Alias: "Ash Crown"
 *
 * A mention of "Ash Crown" can resolve back to the artifact.
 */
export interface AIContextReference {
  id: string
  type: AIContextEntityType
  name: string
  matchedText?: string
  matchedAlias?: string
  score?: number
}

/**
 * Result of resolving references in text.
 */
export interface AIContextReferenceResult {
  references: AIContextReference[]
}
