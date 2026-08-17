import type { Manuscript } from "./manuscript"
import type { Character } from "./character"
import type { Location } from "./world/location"
import type { WorldEvent } from "./world/event"
import type { StoryNote } from "./notes"

export interface MnemeonaProject {
  id: string

  title: string
  author?: string

  createdAt: string
  updatedAt: string

  manuscript: Manuscript

  characters: Character[]

  // World
  locations: Location[]
  events: WorldEvent[]

  /**
   * Persistent author-controlled notes.
   *
   * These are different from storySummary:
   *
   * - notes = author intent, canon, planning and persistent guidance
   * - storySummary = AI-generated summary of what has actually happened
   */
  notes: StoryNote[]

  /**
   * Persistent AI-generated summary of the story so far.
   *
   * This contains established events from previous scenes
   * and gives the AI continuity without sending the entire
   * manuscript every time.
   */
  storySummary: string
  storySummaryFingerprint: string

  settings: {
    activeSceneId: string | null
  }
}
