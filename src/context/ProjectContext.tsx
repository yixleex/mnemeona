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
import type { Faction } from "@/types/world/faction"
import type { Artifact } from "@/types/world/artifact"

import { createProject } from "@/lib/project"

import {
  getCurrentProject,
  saveProjectToDatabase,
} from "@/lib/projectDatabase"

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

    manuscript: {
      ...project.manuscript,

      /*
       * Draft Segment was added after the original
       * project format. Older projects therefore may
       * not have this property.
       */
      draftScenes:
        project.manuscript.draftScenes ??
        [],
    },

    characters:
      project.characters ?? [],

    locations:
      project.locations ?? [],

    events:
      project.events ?? [],

    factions:
      project.factions ?? [],

    artifacts:
      project.artifacts ?? [],

    notes:
      project.notes ?? [],

    storySummary:
      project.storySummary ?? "",

    storySummaryFingerprint:
      project.storySummaryFingerprint ?? "",
  }
}

// --------------------------------------------------
// Draft scene lookup
// --------------------------------------------------

function findDraftScene(
  project: MnemeonaProject,
  sceneId: string | null,
) {
  if (!sceneId) {
    return null
  }

  return (
    project.manuscript.draftScenes ??
    []
  ).find(
    (scene) =>
      scene.id === sceneId,
  ) ?? null
}

// --------------------------------------------------
// Story summary fingerprint
// --------------------------------------------------

/**
 * Creates a deterministic representation of all scenes
 * BEFORE the currently active manuscript scene.
 *
 * Draft scenes intentionally return an empty fingerprint.
 *
 * Draft Segment scenes are independent writing spaces and
 * must never cause or receive Story So Far generation.
 *
 * The active scene itself is deliberately excluded.
 *
 * This gives us a reliable way to determine whether the
 * existing story summary is still valid.
 */
function buildStorySummaryFingerprint(
  project: MnemeonaProject,
  activeSceneId: string | null,
): string {
  if (!activeSceneId) {
    return ""
  }

  /*
   * If the active scene is a draft scene, it does not
   * participate in the manuscript story order.
   *
   * Therefore it must never have a Story So Far
   * fingerprint.
   */
  const activeDraftScene =
    findDraftScene(
      project,
      activeSceneId,
    )

  if (activeDraftScene) {
    return ""
  }

  const parts: string[] = []

  let foundActiveScene = false

  for (
    const act of project.manuscript.acts
  ) {
    for (
      const chapter of act.chapters
    ) {
      for (
        const scene of chapter.scenes
      ) {
        if (
          scene.id ===
          activeSceneId
        ) {
          foundActiveScene =
            true

          break
        }

        parts.push(
          JSON.stringify({
            actId: act.id,
            chapterId:
              chapter.id,
            sceneId:
              scene.id,

            title:
              scene.title,

            synopsis:
              scene.synopsis,

            pov:
              scene.pov,

            location:
              scene.location,

            time:
              scene.time,

            content:
              scene.content,
          }),
        )
      }

      if (
        foundActiveScene
      ) {
        break
      }
    }

    if (
      foundActiveScene
    ) {
      break
    }
  }

  /*
   * If the active ID was not found in the manuscript,
   * it is not a valid manuscript position.
   *
   * This also protects against accidental Story So Far
   * generation if a stale activeSceneId exists.
   */
  if (
    !foundActiveScene
  ) {
    return ""
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

  const [
    summaryGenerating,
    setSummaryGenerating,
  ] = useState(false)

  const [
    databaseHydrated,
    setDatabaseHydrated,
  ] = useState(false)

  const databaseSaveTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null)

  /**
   * Prevents the initial project mount from invoking
   * the AI summary service.
   *
   * A new project starts with its first scene selected,
   * but there is no previous story to summarize yet.
   */
  const hasMounted =
    useRef(false)

  /**
   * Prevents multiple AI summary requests from running
   * simultaneously.
   */
  const summaryRequestInProgress =
    useRef(false)

  // --------------------------------------------------
  // Active scene
  // --------------------------------------------------

  const activeSceneId =
    project.settings.activeSceneId

  /*
   * First look for a normal manuscript scene.
   */
  const manuscriptActiveScene =
    findScene(
      project.manuscript.acts,
      activeSceneId,
    )

  /*
   * If it wasn't found there, look in Draft Segment.
   */
  const draftActiveScene =
    findDraftScene(
      project,
      activeSceneId,
    )

  /*
   * The editor can therefore operate on either type
   * of scene without needing a separate editor.
   */
  const activeScene =
    manuscriptActiveScene ??
    draftActiveScene

  /*
   * Explicitly expose whether the current scene is
   * an independent Draft Segment scene.
   */
  const activeSceneIsDraft =
    draftActiveScene !==
      null &&
    manuscriptActiveScene ===
      null

  // --------------------------------------------------
  // Word counts
  // --------------------------------------------------

  /*
   * Project word count deliberately only counts
   * manuscript scenes.
   *
   * Draft Segment scenes are not part of the manuscript
   * and therefore should not inflate the manuscript count.
   */
  const projectWordCount =
    calculateProjectWordCount(
      project.manuscript.acts,
    )

  /*
   * Active scene count still works for both normal
   * manuscript scenes and draft scenes.
   */
  const activeSceneWordCount =
    calculateSceneWordCount(
      activeScene,
    )

  // --------------------------------------------------
  // Current story-summary fingerprint
  // --------------------------------------------------

  /*
   * Draft scenes produce an empty fingerprint here.
   *
   * This is the main protection preventing Draft Segment
   * scenes from triggering Story So Far generation.
   */
  const storySummaryFingerprint =
    activeSceneIsDraft
      ? ""
      : buildStorySummaryFingerprint(
          project,
          activeSceneId,
        )

  // --------------------------------------------------
  // IndexedDB project persistence
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false

    const restoreProject =
      async () => {
        try {
          const storedProject =
            await getCurrentProject()

          if (
            cancelled
          ) {
            return
          }

          if (
            storedProject
          ) {
            setProject(
              normalizeProject(
                storedProject,
              ),
            )
          } else {
            /*
             * First launch:
             * put the automatically-created project into
             * IndexedDB so it becomes the first local project.
             */
            const initialProject =
              normalizeProject(
                createProject(),
              )

            setProject(
              initialProject,
            )

            await saveProjectToDatabase(
              initialProject,
              true,
            )
          }
        } catch (error) {
          /*
           * IndexedDB should never prevent Mnemeona from
           * starting. Fall back to the in-memory project.
           */
          console.error(
            "Failed to restore project from IndexedDB:",
            error,
          )
        } finally {
          if (
            !cancelled
          ) {
            setDatabaseHydrated(
              true,
            )
          }
        }
      }

    void restoreProject()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !databaseHydrated
    ) {
      return
    }

    /*
     * Debounce IndexedDB writes.
     *
     * This is important because the editor can update the
     * project state many times while the user is typing.
     */
    if (
      databaseSaveTimer.current
    ) {
      clearTimeout(
        databaseSaveTimer.current,
      )
    }

    databaseSaveTimer.current =
      setTimeout(
        () => {
          void saveProjectToDatabase(
            normalizeProject(
              project,
            ),
            true,
          ).catch(
            (error) => {
              console.error(
                "Failed to autosave project to IndexedDB:",
                error,
              )
            },
          )
        },
        500,
      )

    return () => {
      if (
        databaseSaveTimer.current
      ) {
        clearTimeout(
          databaseSaveTimer.current,
        )
      }
    }
  }, [
    project,
    databaseHydrated,
  ])

  // --------------------------------------------------
  // Story summary generation
  // --------------------------------------------------

  function showStorySummaryError(
    error: unknown,
  ): void {
    let message =
      "Unknown error"

    if (
      error instanceof Error
    ) {
      message =
        error.message ||
        "Unknown error"
    } else if (
      typeof error ===
      "string"
    ) {
      message = error
    } else {
      try {
        message =
          JSON.stringify(
            error,
          )
      } catch {
        message =
          "Unknown error"
      }
    }

    console.error(
      "STORY SUMMARY GENERATION FAILED:",
      error,
    )

    window.alert(
      `Story Summary Failed\n\n${message}\n\nCheck the browser console for additional details.`,
    )
  }

  const updateStorySummary =
    useCallback(
      async (
        targetProject: MnemeonaProject,
      ) => {
        const normalizedProject =
          normalizeProject(
            targetProject,
          )

        const sceneId =
          normalizedProject
            .settings
            .activeSceneId

        if (!sceneId) {
          return
        }

        /*
         * Never generate Story So Far for a Draft Segment
         * scene.
         */
        const draftScene =
          findDraftScene(
            normalizedProject,
            sceneId,
          )

        if (draftScene) {
          return
        }

        const targetScene =
          findScene(
            normalizedProject
              .manuscript
              .acts,
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
         * There is no previous story before the first
         * scene, so there is nothing to summarize.
         */
        if (
          !fingerprint.trim()
        ) {
          return
        }

        /**
         * The current summary already represents the
         * exact story state before this scene.
         */
        if (
          normalizedProject
            .storySummary
            ?.trim() &&
          normalizedProject
            .storySummaryFingerprint ===
            fingerprint
        ) {
          return
        }

        /**
         * Don't allow overlapping AI requests.
         */
        if (
          summaryRequestInProgress
            .current
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

          if (
            !summary?.trim()
          ) {
            return
          }

          /**
           * The manuscript can change while the AI is
           * generating.
           *
           * Only accept the generated summary if the
           * project still represents the exact same
           * story state that was sent to the AI.
           */
          setProject(
            (currentProject) => {
              const current =
                normalizeProject(
                  currentProject,
                )

              const currentSceneId =
                current.settings
                  .activeSceneId

              /*
               * Do not attach a summary if the user
               * changed scenes while generation was
               * happening.
               */
              if (
                currentSceneId !==
                sceneId
              ) {
                return current
              }

              /*
               * Also make absolutely sure the scene
               * didn't become a Draft Segment scene.
               */
              if (
                findDraftScene(
                  current,
                  currentSceneId,
                )
              ) {
                return current
              }

              const currentFingerprint =
                buildStorySummaryFingerprint(
                  current,
                  currentSceneId,
                )

              if (
                currentFingerprint !==
                fingerprint
              ) {
                /**
                 * The story changed while the request was
                 * running. Don't attach a stale summary.
                 */
                return current
              }

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
           * AI/Ollama failures must never crash the
           * application.
           */
          showStorySummaryError(
            error,
          )

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
      [],
    )

  // --------------------------------------------------
  // Automatic story-summary update
  // --------------------------------------------------

  useEffect(() => {
    /**
     * Never generate a summary during the initial
     * application mount.
     *
     * This is the startup-crash protection.
     */
    if (
      !hasMounted.current
    ) {
      hasMounted.current =
        true

      return
    }

    if (!activeSceneId) {
      return
    }

    /*
     * Draft Segment scenes must never trigger the
     * Story So Far system.
     */
    if (
      activeSceneIsDraft
    ) {
      return
    }

    /**
     * First scene has no previous story.
     */
    if (
      !storySummaryFingerprint.trim()
    ) {
      return
    }

    /**
     * Nothing has changed since the last summary.
     */
    if (
      project.storySummary?.trim() &&
      project
        .storySummaryFingerprint ===
        storySummaryFingerprint
    ) {
      return
    }

    /**
     * An existing request is already processing.
     */
    if (
      summaryRequestInProgress
        .current
    ) {
      return
    }

    void updateStorySummary(
      project,
    )
  }, [
    activeSceneId,
    activeSceneIsDraft,
    storySummaryFingerprint,
    project.storySummary,
    project.storySummaryFingerprint,
    project,
    updateStorySummary,
  ])

  // --------------------------------------------------
  // Project actions
  // --------------------------------------------------

  const createNewProject =
    useCallback(
      (
        title =
          "Untitled Novel",
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
        const projectToSave =
          normalizeProject(
            project,
          )

        await projectActions.saveProject(
          projectToSave,
        )
      },
      [project],
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
        activeSceneIsDraft,

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
        activeSceneIsDraft,

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
