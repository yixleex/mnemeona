export type FactionType =
  | "Kingdom"
  | "Empire"
  | "Nation"
  | "City-State"
  | "Guild"
  | "Company"
  | "House"
  | "Clan"
  | "Tribe"
  | "Religious Order"
  | "Military"
  | "Rebel Group"
  | "Criminal Organization"
  | "Secret Society"
  | "Political Movement"
  | "Academic Organization"
  | "Other"

export interface Faction {
  id: string

  name: string
  type: FactionType

  description: string

  /**
   * ID of the Character who leads this faction.
   */
  leaderCharacterId?: string

  /**
   * ID of the Location that serves as this faction's
   * headquarters/base/seat of power.
   */
  headquartersLocationId?: string

  goals?: string
  values?: string
  resources?: string

  allies?: string
  enemies?: string

  history?: string
  secrets?: string

  createdAt: string
  updatedAt: string
}
