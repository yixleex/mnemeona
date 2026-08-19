import type { FactionType } from "./factionTypes"

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
