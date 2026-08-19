export type LoreType =
  | "Myth"
  | "Legend"
  | "Religion"
  | "Tradition"
  | "Custom"
  | "Prophecy"
  | "Folklore"
  | "Historical Record"
  | "Philosophy"
  | "Theory"
  | "Other"

export interface Lore {
  id: string

  /**
   * The canonical name of this piece of world lore.
   *
   * Examples:
   * - "The Prophecy of the Last King"
   * - "The Old Gods"
   * - "The First Sundering"
   */
  name: string

  /**
   * Alternative names or phrases the lore may be
   * referred to by in the story.
   *
   * Examples:
   * - "The Last King's Prophecy"
   * - "The King's Prophecy"
   * - "The Final Prophecy"
   *
   * Multi-word aliases are fully supported.
   */
  aliases: string[]

  type: LoreType

  /**
   * General description of the lore.
   */
  description: string

  /**
   * Where this lore originated.
   */
  origins?: string

  /**
   * Beliefs, customs, practices, or ideas associated
   * with this piece of lore.
   */
  beliefs?: string

  /**
   * Why this lore is important to the world or story.
   */
  significance?: string

  /**
   * Known historical account or development of the lore.
   */
  history?: string

  /**
   * What is actually true about the lore.
   *
   * This can differ from what characters believe.
   */
  truth?: string

  /**
   * Hidden information, mysteries, contradictions,
   * forbidden knowledge, etc.
   */
  secrets?: string

  createdAt: string

  updatedAt: string
}
