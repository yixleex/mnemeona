export type ArtifactType =
  | "Weapon"
  | "Armor"
  | "Relic"
  | "Book"
  | "Tool"
  | "Jewelry"
  | "Technology"
  | "Magical Object"
  | "Key"
  | "Other"

export interface Artifact {
  id: string

  name: string

  /**
   * Alternative names the artifact may be referred to by.
   *
   * Examples:
   * - "The Sword of Kings"
   * - aliases: ["King's Sword", "The Royal Blade", "Kingsblade"]
   *
   * The AI context detector searches both the canonical name
   * and these aliases.
   */
  aliases: string[]

  type: ArtifactType

  description: string

  /** ID of the Character who currently possesses the artifact. */
  ownerCharacterId?: string

  /** ID of the Location where the artifact is kept or located. */
  locationId?: string

  powers?: string
  abilities?: string
  appearance?: string
  history?: string
  significance?: string
  secrets?: string

  createdAt: string
  updatedAt: string
}
