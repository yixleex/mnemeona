import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"

import type { JSONContent } from "@tiptap/core"

import {
  calculateProjectWordCount,
  calculateSceneWordCount,
  findScene,
} from "./project/projectHelpers"
import * as projectActions from "./project/projectActions"
import * as manuscriptActions from "./manuscript/manuscriptActions"
import * as characterActions from "./character/characterActions"
import * as locationActions from "./world/location/locationActions"
import * as eventActions from "./world/event/eventActions"

import type { MnemeonaProject } from "@/types/project"

import type { ProjectContextValue } from "./ProjectContext.types"
import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"
import type { WorldEvent } from "@/types/world/event"

import { createProject } from "@/lib/project"

import { generateStorySummary } from "@/components/ai/aiservice/aiService"

const ProjectContext =
  createContext<ProjectContextValue | null>(null)

// --------------------------------------------------
// Project Normalization
// --------------------------------------------------

/**
 * Ensures projects created before newer World Database
 * collections were introduced remain compatible.
 */
function normalizeProject(
  project: MnemeonaProject,
): MnemeonaProject {
  return {
    ...project,
    locations: project.locations ?? [],
    events: project.events ?? [],
    characters: project.characters ?? [],
    notes: project.notes ?? [],
    storySummary: project.storySummary ?? "",
    storySummaryFingerprint:
      project.storySummaryFingerprint ?? "",
  }
}

// --------------------------------------------------
// Summary Fingerprint
// --------------------------------------------------

/**
 * Creates a deterministic representation of the
 * scenes that belong to the story summary.
 *
 * The summary represents everything BEFORE the
 * currently selected scene.
 *
 * If none of those scenes changed, the summary
 * does not need to be regenerated.
 */
function buildStorySummaryFingerprint(
  project: MnemeonaProject,
  activeSceneId: string | null,
): string {
  if (!activeSceneId) {
    return ""
  }

  const parts: string[] = []

  let reachedActiveScene = false

  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      for (const scene of chapter.scenes) {
        if (scene.id === activeSceneId) {
          reachedActiveScene = true
          break
        }

        parts.push(
          JSON.stringify({
            actId: act.id,
            chapterId: chapter.id,
            sceneId: scene.id,
            title: scene.title,
            synopsis: scene.synopsis,
            pov: scene.pov,
            location: scene.location,
            time: scene.time,
            content: scene.content,
          }),
        )
      }

      if (reachedActiveScene) {
        break
      }
    }

    if (reachedActiveScene) {
      break
    }
  }

  return parts.join("\n")
}

// --------------------------------------------------
// Provider
// --------------------------------------------------

export function ProjectProvider({
  children,
}: {
  children: ReactNode
}) {
  const [project, setProject] =
    useState<MnemeonaProject>(() =>
      normalizeProject(createProject()),
    )

  const [summaryGenerating, setSummaryGenerating] =
    useState(false)

  /**
   * Prevents the automatic summary effect from
   * running during the initial application mount.
   *
   * The first scene is automatically selected when
   * a project is created, but that does NOT mean the
   * user has entered/navigated to a new scene.
   */
  const hasMounted = useRef(false)

  // --------------------------------------------------
  // Active scene
  // --------------------------------------------------

  const activeSceneId =
    project.settings.activeSceneId

  const activeScene =
    findScene(
      project.manuscript.acts,
      activeSceneId,
    )

  // --------------------------------------------------
  // Word counts
  // --------------------------------------------------

  const activeSceneWordCount =
    calculateSceneWordCount(activeScene)

  const projectWordCount =
    calculateProjectWordCount(
      project.manuscript.acts,
    )

  // --------------------------------------------------
  // Story Summary
  // --------------------------------------------------

  const updateStorySummary = useCallback(
    async (
      targetProject: MnemeonaProject = project,
    ) => {
      const normalizedProject =
        normalizeProject(targetProject)

      const sceneId =
        normalizedProject.settings.activeSceneId

      if (!sceneId) {
        return
      }

      const targetScene =
        findScene(
          normalizedProject.manuscript.acts,
          sceneId,
        )

      if (!targetScene) {
        return
      }

      const currentFingerprint =
        buildStorySummaryFingerprint(
          normalizedProject,
          sceneId,
        )

      /**
       * If the summary already represents exactly
       * this manuscript state, there is nothing to do.
       */
      if (
        normalizedProject.storySummary.trim() &&
        normalizedProject.storySummaryFingerprint ===
          currentFingerprint
      ) {
        return
      }

      /**
       * Do not generate a summary when there are no
       * previous scenes yet.
       *
       * This is important for a brand-new project:
       * the first scene does not have any story
       * history that needs summarizing.
       */
      if (!currentFingerprint.trim()) {
        return
      }

      setSummaryGenerating(true)

      try {
        const summary =
          await generateStorySummary(
            normalizedProject,
            targetScene,
          )

        if (!summary.trim()) {
          return
        }

        setProject((current) => ({
          ...normalizeProject(current),
          storySummary: summary,
          storySummaryFingerprint:
            currentFingerprint,
          updatedAt:
            new Date().toISOString(),
        }))
      } catch (error) {
        console.error(
          "Failed to generate story summary:",
          error,
        )
      } finally {
        setSummaryGenerating(false)
      }
    },
    [project],
  )

  // --------------------------------------------------
  // Project
  // --------------------------------------------------

  const createNewProject = useCallback(
    (
      title = "Untitled Novel",
    ) => {
      projectActions.createNewProject(
        setProject,
        title,
      )
    },
    [],
  )

  const loadProject = useCallback(
    () => {
      projectActions.loadProject(
        (loadedProject) => {
          setProject(
            normalizeProject(
              loadedProject,
            ),
          )
        },
      )
    },
    [],
  )

  // --------------------------------------------------
  // Save Project
  // --------------------------------------------------

  const saveProject = useCallback(
    async () => {
      let projectToSave =
        normalizeProject(project)

      const sceneId =
        projectToSave.settings.activeSceneId

      if (sceneId) {
        const scene =
          findScene(
            projectToSave.manuscript.acts,
            sceneId,
          )

        if (scene) {
          const fingerprint =
            buildStorySummaryFingerprint(
              projectToSave,
              sceneId,
            )

          /**
           * Only generate a summary if there are
           * previous scenes to summarize.
           */
          const hasPreviousScenes =
            fingerprint.trim().length > 0

          const summaryIsCurrent =
            Boolean(
              projectToSave.storySummary.trim(),
            ) &&
            projectToSave.storySummaryFingerprint ===
              fingerprint

          if (
            hasPreviousScenes &&
            !summaryIsCurrent
          ) {
            setSummaryGenerating(true)

            try {
              const summary =
                await generateStorySummary(
                  projectToSave,
                  scene,
                )

              if (summary.trim()) {
                projectToSave = {
                  ...projectToSave,
                  storySummary: summary,
                  storySummaryFingerprint:
                    fingerprint,
                  updatedAt:
                    new Date().toISOString(),
                }

                setProject(
                  projectToSave,
                )
              }
            } catch (error) {
              console.error(
                "Failed to generate story summary before save:",
                error,
              )
            } finally {
              setSummaryGenerating(false)
            }
          }
        }
      }

      await projectActions.saveProject(
        projectToSave,
      )
    },
    [project],
  )

  const updateProject = useCallback(
    (
      updater: (
        project: MnemeonaProject,
      ) => MnemeonaProject,
    ) =>
      projectActions.updateProject(
        setProject,
        updater,
      ),
    [],
  )

  const renameProject = useCallback(
    (
      title: string,
    ) =>
      projectActions.renameProject(
        setProject,
        title,
      ),
    [],
  )

  // --------------------------------------------------
  // Manuscript
  // --------------------------------------------------

  const setActiveScene = useCallback(
    (
      sceneId: string | null,
    ) => {
      manuscriptActions.setActiveScene(
        setProject,
        sceneId,
      )
    },
    [],
  )

  const addAct = useCallback(
    () =>
      manuscriptActions.addAct(
        setProject,
      ),
    [],
  )

  const addChapter = useCallback(
    (
      actId: string,
    ) =>
      manuscriptActions.addChapter(
        setProject,
        actId,
      ),
    [],
  )

  const addScene = useCallback(
    (
      actId: string,
      chapterId: string,
    ) =>
      manuscriptActions.addScene(
        setProject,
        actId,
        chapterId,
      ),
    [],
  )

  const renameAct = useCallback(
    (
      actId: string,
      title: string,
    ) =>
      manuscriptActions.renameAct(
        setProject,
        actId,
        title,
      ),
    [],
  )

  const renameChapter = useCallback(
    (
      actId: string,
      chapterId: string,
      title: string,
    ) =>
      manuscriptActions.renameChapter(
        setProject,
        actId,
        chapterId,
        title,
      ),
    [],
  )

  const renameScene = useCallback(
    (
      actId: string,
      chapterId: string,
      sceneId: string,
      title: string,
    ) =>
      manuscriptActions.renameScene(
        setProject,
        actId,
        chapterId,
        sceneId,
        title,
      ),
    [],
  )

  const deleteAct = useCallback(
    (
      actId: string,
    ) =>
      manuscriptActions.deleteAct(
        setProject,
        actId,
      ),
    [],
  )

  const deleteChapter = useCallback(
    (
      actId: string,
      chapterId: string,
    ) =>
      manuscriptActions.deleteChapter(
        setProject,
        actId,
        chapterId,
      ),
    [],
  )

  const deleteScene = useCallback(
    (
      actId: string,
      chapterId: string,
      sceneId: string,
    ) =>
      manuscriptActions.deleteScene(
        setProject,
        actId,
        chapterId,
        sceneId,
      ),
    [],
  )

  const moveAct = useCallback(
    (
      fromIndex: number,
      toIndex: number,
    ) =>
      manuscriptActions.moveAct(
        setProject,
        fromIndex,
        toIndex,
      ),
    [],
  )

  const moveChapter = useCallback(
    (
      actId: string,
      fromIndex: number,
      toIndex: number,
    ) =>
      manuscriptActions.moveChapter(
        setProject,
        actId,
        fromIndex,
        toIndex,
        ),
    [],
  )

  const moveScene = useCallback(
    (
      actId: string,
      chapterId: string,
      fromIndex: number,
      toIndex: number,
    ) =>
      manuscriptActions.moveScene(
        setProject,
        actId,
        chapterId,
        fromIndex,
        toIndex,
      ),
    [],
  )

  const updateSceneContent = useCallback(
    (
      sceneId: string,
      content: JSONContent,
    ) =>
      manuscriptActions.updateSceneContent(
        setProject,
        sceneId,
        content,
      ),
    [],
  )

  // --------------------------------------------------
  // Automatically update summary when the user
  // navigates to another scene.
  // --------------------------------------------------

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    if (!activeSceneId) {
      return
    }

    void updateStorySummary(project)

    // The effect intentionally only depends on the
    // selected scene. The fingerprint check inside
    // updateStorySummary determines whether an AI
    // request is actually necessary.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneId])

  // --------------------------------------------------
  // Characters
  // --------------------------------------------------

  const addCharacter = useCallback(
    () =>
      characterActions.addCharacter(
        setProject,
      ),
    [],
  )

  const updateCharacter = useCallback(
    (
      characterId: string,
      updates: Partial<Character>,
    ) =>
      characterActions.updateCharacter(
        setProject,
        characterId,
        updates,
      ),
    [],
  )

  const deleteCharacter = useCallback(
    (
      characterId: string,
    ) =>
      characterActions.deleteCharacter(
        setProject,
        characterId,
      ),
    [],
  )

  const updateCharacterContext = useCallback(
    (
      characterId: string,
      enabled: boolean,
    ) =>
      characterActions.updateCharacterContext(
        setProject,
        characterId,
        enabled,
      ),
    [],
  )

  // --------------------------------------------------
  // Character Relationships
  // --------------------------------------------------

  const addCharacterRelationship =
    useCallback(
      (
        characterId: string,
        targetCharacterId: string,
        type = "",
        description = "",
      ) =>
        characterActions.addCharacterRelationship(
          setProject,
          characterId,
          targetCharacterId,
          type,
          description,
        ),
      [],
    )

  const updateCharacterRelationship =
    useCallback(
      (
        characterId: string,
        relationshipId: string,
        updates: {
          targetCharacterId?: string
          type?: string
          description?: string
        },
      ) =>
        characterActions.updateCharacterRelationship(
          setProject,
          characterId,
          relationshipId,
          updates,
        ),
      [],
    )

  const deleteCharacterRelationship =
    useCallback(
      (
        characterId: string,
        relationshipId: string,
      ) =>
        characterActions.deleteCharacterRelationship(
          setProject,
          characterId,
          relationshipId,
        ),
      [],
    )

  // --------------------------------------------------
  // Locations
  // --------------------------------------------------

  const addLocation = useCallback(
    (
      location: Omit<
        Location,
        "id" | "createdAt" | "updatedAt"
      >,
    ) =>
      locationActions.addLocation(
        setProject,
        location,
      ),
    [],
  )

  const updateLocation = useCallback(
    (
      locationId: string,
      updates: Partial<Location>,
    ) =>
      locationActions.updateLocation(
        setProject,
        locationId,
        updates,
      ),
    [],
  )

  const deleteLocation = useCallback(
    (
      locationId: string,
    ) =>
      locationActions.deleteLocation(
        setProject,
        locationId,
      ),
    [],
  )

  // --------------------------------------------------
  // Events
  // --------------------------------------------------

  const addEvent = useCallback(
    (
      event: Omit<
        WorldEvent,
        "id" | "createdAt" | "updatedAt"
      >,
    ) =>
      eventActions.addEvent(
        setProject,
        event,
      ),
    [],
  )

  const updateEvent = useCallback(
    (
      eventId: string,
      updates: Partial<WorldEvent>,
    ) =>
      eventActions.updateEvent(
        setProject,
        eventId,
        updates,
      ),
    [],
  )

  const deleteEvent = useCallback(
    (
      eventId: string,
    ) =>
      eventActions.deleteEvent(
        setProject,
        eventId,
      ),
    [],
  )

  // --------------------------------------------------
  // Context value
  // --------------------------------------------------

  const value = useMemo(
    () => ({
      project,

      activeSceneId,
      activeScene,

      projectWordCount,
      activeSceneWordCount,

      summaryGenerating,
      updateStorySummary,

      setActiveScene,

      createNewProject,
      loadProject,
      saveProject,
      updateProject,
      renameProject,

      // Manuscript
      addAct,
      addChapter,
      addScene,

      renameAct,
      renameChapter,
      renameScene,

      deleteAct,
      deleteChapter,
      deleteScene,

      moveAct,
      moveChapter,
      moveScene,

      updateSceneContent,

      // Characters
      addCharacter,
      updateCharacter,
      deleteCharacter,
      updateCharacterContext,

      // Character Relationships
      addCharacterRelationship,
      updateCharacterRelationship,
      deleteCharacterRelationship,

      // Locations
      addLocation,
      updateLocation,
      deleteLocation,

      // Events
      addEvent,
      updateEvent,
      deleteEvent,
    }),
    [
      project,
      activeSceneId,
      activeScene,
      projectWordCount,
      activeSceneWordCount,

      summaryGenerating,
      updateStorySummary,

      setActiveScene,
      createNewProject,
      loadProject,
      saveProject,
      updateProject,
      renameProject,

      addAct,
      addChapter,
      addScene,

      renameAct,
      renameChapter,
      renameScene,

      deleteAct,
      deleteChapter,
      deleteScene,

      moveAct,
      moveChapter,
      moveScene,

      updateSceneContent,

      addCharacter,
      updateCharacter,
      deleteCharacter,
      updateCharacterContext,

      addCharacterRelationship,
      updateCharacterRelationship,
      deleteCharacterRelationship,

      addLocation,
      updateLocation,
      deleteLocation,

      addEvent,
      updateEvent,
      deleteEvent,
    ],
  )

  return (
    <ProjectContext.Provider
      value={value}
    >
      {children}
    </ProjectContext.Provider>
  )
}

// --------------------------------------------------
// Hook
// --------------------------------------------------

export function useProject() {
  const context =
    useContext(ProjectContext)

  if (!context) {
    throw new Error(
      "useProject must be used inside ProjectProvider",
    )
  }

  return context
}
