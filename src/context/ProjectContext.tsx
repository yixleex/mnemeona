import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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

import type { ProjectContextValue } from "./ProjectContext.types"
import type { MnemeonaProject } from "@/types/project"
import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"
import type { WorldEvent } from "@/types/world/event"

import { createProject } from "@/lib/project"

import { generateStorySummary } from "@/components/ai/aiservice/aiService"

const ProjectContext =
  createContext<ProjectContextValue | null>(null)

// --------------------------------------------------
// Project normalization
// --------------------------------------------------

function normalizeProject(
  project: MnemeonaProject,
): MnemeonaProject {
  return {
    ...project,

    characters:
      project.characters ?? [],

    locations:
      project.locations ?? [],

    events:
      project.events ?? [],

    notes:
      project.notes ?? [],

    storySummary:
      project.storySummary ?? "",

    storySummaryFingerprint:
      project.storySummaryFingerprint ?? "",
  }
}

// --------------------------------------------------
// Story summary fingerprint
// --------------------------------------------------

/**
 * Creates a deterministic representation of every
 * scene BEFORE the currently active scene.
 *
 * The active scene itself is deliberately excluded.
 *
 * This means:
 *
 * Scene 1 -> Scene 2
 *   => summarize Scene 1
 *
 * Edit Scene 1 -> Scene 2
 *   => summarize again
 *
 * Edit Scene 2 while staying in Scene 2
 *   => do NOT summarize Scene 2 itself
 *
 * Enter Scene 3
 *   => Scene 1 + Scene 2 are now included
 */
function buildStorySummaryFingerprint(
  project: MnemeonaProject,
  activeSceneId: string | null,
): string {
  if (!activeSceneId) {
    return ""
  }

  const parts: string[] = []

  let foundActiveScene = false

  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      for (const scene of chapter.scenes) {
        if (scene.id === activeSceneId) {
          foundActiveScene = true
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

      if (foundActiveScene) {
        break
      }
    }

    if (foundActiveScene) {
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
      normalizeProject(
        createProject(),
      ),
    )

  const [summaryGenerating, setSummaryGenerating] =
    useState(false)

  /**
   * Prevents summary generation during the initial
   * React mount.
   *
   * This is the important startup-crash protection.
   *
   * A newly-created project normally has an active
   * first scene. We do NOT want that to immediately
   * invoke the AI service while the application is
   * booting.
   */
  const hasMounted =
    useRef(false)

  /**
   * Prevent multiple simultaneous summary requests.
   *
   * React can produce multiple state changes while the
   * user is editing/navigating. We only want one AI
   * summary request at a time.
   */
  const summaryRequestInProgress =
    useRef(false)

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
    calculateSceneWordCount(
      activeScene,
    )

  const projectWordCount =
    calculateProjectWordCount(
      project.manuscript.acts,
    )

  // --------------------------------------------------
  // Story summary fingerprint
  // --------------------------------------------------

  const storySummaryFingerprint =
    useMemo(
      () =>
        buildStorySummaryFingerprint(
          project,
          activeSceneId,
        ),
      [
        project,
        activeSceneId,
      ],
    )

  // --------------------------------------------------
  // Story summary generation
  // --------------------------------------------------

  const updateStorySummary =
    useCallback(
      async (
        targetProject: MnemeonaProject = project,
      ) => {
        const normalizedProject =
          normalizeProject(
            targetProject,
          )

        const sceneId =
          normalizedProject.settings
            .activeSceneId

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

        const fingerprint =
          buildStorySummaryFingerprint(
            normalizedProject,
            sceneId,
          )

        /**
         * There is no story before the first scene,
         * so there is nothing meaningful to summarize.
         */
        if (!fingerprint.trim()) {
          return
        }

        /**
         * The stored summary already represents the
         * exact previous-story state.
         */
        if (
          normalizedProject.storySummary.trim() &&
          normalizedProject.storySummaryFingerprint ===
            fingerprint
        ) {
          return
        }

        /**
         * Never allow two summary requests to overlap.
         */
        if (
          summaryRequestInProgress.current
        ) {
          return
        }

        summaryRequestInProgress.current =
          true

        setSummaryGenerating(
          true,
        )

        try {
          const summary =
            await generateStorySummary(
              normalizedProject,
              targetScene,
            )

          if (!summary?.trim()) {
            return
          }

          /**
           * Important:
           *
           * Do not blindly write the result into state
           * if the project changed while the AI request
           * was running.
           *
           * The fingerprint attached to the generated
           * summary identifies exactly which story state
           * it represents.
           */
          setProject(
            (currentProject) => {
              const current =
                normalizeProject(
                  currentProject,
                )

              return {
                ...current,

                storySummary:
                  summary,

                storySummaryFingerprint:
                  fingerprint,

                updatedAt:
                  new Date().toISOString(),
              }
            },
          )
        } catch (error) {
          /**
           * AI failure must NEVER prevent the application
           * from rendering or editing.
           */
          console.error(
            "Failed to generate story summary:",
            error,
          )
        } finally {
          summaryRequestInProgress.current =
            false

          setSummaryGenerating(
            false,
          )
        }
      },
      [project],
    )

  // --------------------------------------------------
  // Automatic summary update
  // --------------------------------------------------

  useEffect(() => {
    /**
     * Initial mount:
     *
     * Do nothing.
     *
     * This prevents the AI service from becoming part
     * of application startup.
     */
    if (!hasMounted.current) {
      hasMounted.current =
        true

      return
    }

    if (!activeSceneId) {
      return
    }

    /**
     * There is nothing to summarize before Scene 1.
     */
    if (
      !storySummaryFingerprint.trim()
    ) {
      return
    }

    /**
     * If the current summary already corresponds to
     * the current story state, nothing needs to happen.
     */
    if (
      project.storySummary.trim() &&
      project.storySummaryFingerprint ===
        storySummaryFingerprint
    ) {
      return
    }

    /**
     * Summary creation is deliberately fire-and-forget.
     *
     * Any AI/Ollama error is caught inside
     * updateStorySummary and cannot crash React.
     */
    void updateStorySummary(
      project,
    )
  }, [
    activeSceneId,
    storySummaryFingerprint,
    project.storySummary,
    project.storySummaryFingerprint,
    updateStorySummary,
  ])

  // --------------------------------------------------
  // Project actions
  // --------------------------------------------------

  const createNewProject =
    useCallback(
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

  const loadProject =
    useCallback(
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

  const saveProject =
    useCallback(
      async () => {
        let projectToSave =
          normalizeProject(
            project,
          )

        const sceneId =
          projectToSave.settings
            .activeSceneId

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

            const hasPreviousStory =
              fingerprint.trim()
                .length > 0

            const summaryIsCurrent =
              Boolean(
                projectToSave.storySummary.trim(),
              ) &&
              projectToSave.storySummaryFingerprint ===
                fingerprint

            if (
              hasPreviousStory &&
              !summaryIsCurrent
            ) {
              await updateStorySummary(
                projectToSave,
              )

              /**
               * updateStorySummary writes the generated
               * summary into React state asynchronously.
               *
               * Keep the project being saved synchronized
               * with the current state before saving.
               */
              projectToSave =
                normalizeProject(
                  projectToSave,
                )
            }
          }
        }

        await projectActions.saveProject(
          projectToSave,
        )
      },
      [
        project,
        updateStorySummary,
      ],
    )

  const updateProject =
    useCallback(
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

  const renameProject =
    useCallback(
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

  const setActiveScene =
    useCallback(
      (
        sceneId: string | null,
      ) =>
        manuscriptActions.setActiveScene(
          setProject,
          sceneId,
        ),
      [],
    )

  const addAct =
    useCallback(
      () =>
        manuscriptActions.addAct(
          setProject,
        ),
      [],
    )

  const addChapter =
    useCallback(
      (
        actId: string,
      ) =>
        manuscriptActions.addChapter(
          setProject,
          actId,
        ),
      [],
    )

  const addScene =
    useCallback(
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

  const renameAct =
    useCallback(
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

  const renameChapter =
    useCallback(
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

  const renameScene =
    useCallback(
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

  const deleteAct =
    useCallback(
      (
        actId: string,
      ) =>
        manuscriptActions.deleteAct(
          setProject,
          actId,
        ),
      [],
    )

  const deleteChapter =
    useCallback(
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

  const deleteScene =
    useCallback(
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

  const moveAct =
    useCallback(
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

  const moveChapter =
    useCallback(
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

  const moveScene =
    useCallback(
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

  const updateSceneContent =
    useCallback(
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
  // Characters
  // --------------------------------------------------

  const addCharacter =
    useCallback(
      () =>
        characterActions.addCharacter(
          setProject,
        ),
      [],
    )

  const updateCharacter =
    useCallback(
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

  const deleteCharacter =
    useCallback(
      (
        characterId: string,
      ) =>
        characterActions.deleteCharacter(
          setProject,
          characterId,
        ),
      [],
    )

  const updateCharacterContext =
    useCallback(
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
  // Character relationships
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

  const addLocation =
    useCallback(
      (
        location: Omit<
          Location,
          "id" |
            "createdAt" |
            "updatedAt"
        >,
      ) =>
        locationActions.addLocation(
          setProject,
          location,
        ),
      [],
    )

  const updateLocation =
    useCallback(
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

  const deleteLocation =
    useCallback(
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

  const addEvent =
    useCallback(
      (
        event: Omit<
          WorldEvent,
          "id" |
            "createdAt" |
            "updatedAt"
        >,
      ) =>
        eventActions.addEvent(
          setProject,
          event,
        ),
      [],
    )

  const updateEvent =
    useCallback(
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

  const deleteEvent =
    useCallback(
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

  const value =
    useMemo(
      () => ({
        project,

        activeSceneId,
        activeScene,

        projectWordCount,
        activeSceneWordCount,

        summaryGenerating,
        updateStorySummary,

        createNewProject,
        loadProject,
        saveProject,
        updateProject,
        renameProject,

        setActiveScene,

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
      }),
      [
        project,

        activeSceneId,
        activeScene,

        projectWordCount,
        activeSceneWordCount,

        summaryGenerating,
        updateStorySummary,

        createNewProject,
        loadProject,
        saveProject,
        updateProject,
        renameProject,

        setActiveScene,

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
