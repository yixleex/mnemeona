import type { JSONContent } from "@tiptap/react"

import type { MnemeonaProject } from "@/types/project"
import type { Scene } from "@/types/manuscript"
import type { Character } from "@/types/character"
import type { Location } from "@/types/location"

export interface ProjectContextValue {
  project: MnemeonaProject

  activeSceneId: string | null
  activeScene: Scene | null

  projectWordCount: number
  activeSceneWordCount: number

  setActiveScene: (
    sceneId: string | null,
  ) => void

  createNewProject: (
    title?: string,
  ) => void

  loadProject: () => Promise<void>

  saveProject: () => void

  updateProject: (
    updater: (
      project: MnemeonaProject,
    ) => MnemeonaProject,
  ) => void

  renameProject: (
    title: string,
  ) => void

  // --------------------------------------------------
  // AI Story Summary
  // --------------------------------------------------

  /**
   * True while Mnemeona AI is generating or updating
   * the story continuity summary.
   *
   * The application uses this to block the UI and
   * display the summary-generation loading modal.
   */
  summaryGenerating: boolean

  /**
   * Generate/update the story summary using all scenes
   * up to the supplied scene.
   *
   * If no project is supplied, the current project is used.
   */
  updateStorySummary: (
    project?: MnemeonaProject,
  ) => Promise<void>

  // --------------------------------------------------
  // Manuscript
  // --------------------------------------------------

  addAct: () => void

  addChapter: (
    actId: string,
  ) => void

  addScene: (
    actId: string,
    chapterId: string,
  ) => void

  renameAct: (
    actId: string,
    title: string,
  ) => void

  renameChapter: (
    actId: string,
    chapterId: string,
    title: string,
  ) => void

  renameScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
    title: string,
  ) => void

  deleteAct: (
    actId: string,
  ) => void

  deleteChapter: (
    actId: string,
    chapterId: string,
  ) => void

  deleteScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
  ) => void

  moveAct: (
    fromIndex: number,
    toIndex: number,
  ) => void

  moveChapter: (
    actId: string,
    fromIndex: number,
    toIndex: number,
  ) => void

  moveScene: (
    actId: string,
    chapterId: string,
    fromIndex: number,
    toIndex: number,
  ) => void

  updateSceneContent: (
    sceneId: string,
    content: JSONContent,
  ) => void

  // --------------------------------------------------
  // Characters
  // --------------------------------------------------

  addCharacter: () => string

  updateCharacter: (
    characterId: string,
    updates: Partial<Character>,
  ) => void

  deleteCharacter: (
    characterId: string,
  ) => void

  updateCharacterContext: (
    characterId: string,
    enabled: boolean,
  ) => void

  // --------------------------------------------------
  // Character Relationships
  // --------------------------------------------------

  addCharacterRelationship: (
    characterId: string,
    targetCharacterId: string,
    type?: string,
    description?: string,
  ) => string

  updateCharacterRelationship: (
    characterId: string,
    relationshipId: string,
    updates: {
      targetCharacterId?: string
      type?: string
      description?: string
    },
  ) => void

  deleteCharacterRelationship: (
    characterId: string,
    relationshipId: string,
  ) => void

  // --------------------------------------------------
  // Locations
  // --------------------------------------------------

  addLocation: (
    location: Omit<
      Location,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => string

  updateLocation: (
    locationId: string,
    updates: Partial<Location>,
  ) => void

  deleteLocation: (
    locationId: string,
  ) => void
}
