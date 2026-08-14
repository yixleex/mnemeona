export type WorldEventType =
  | "Historical"
  | "Political"
  | "Military"
  | "Religious"
  | "Social"
  | "Natural"
  | "Personal"
  | "Discovery"
  | "Festival"
  | "Crime"
  | "Other"

export interface WorldEvent {
  id: string
  name: string
  aliases: string[]
  type: WorldEventType
  description: string

  /**
   * When the event occurs in the world's timeline.
   *
   * This is intentionally a string so the project can support
   * custom fictional calendars and date formats.
   */
  date?: string

  /**
   * Optional location where the event takes place.
   */
  locationId?: string

  /**
   * Story-specific context.
   */
  significance?: string
  history?: string
  consequences?: string
  secrets?: string

  createdAt: string
  updatedAt: string
}
