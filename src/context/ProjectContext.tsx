import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
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

import type { MnemeonaProject } from "@/types/project"

import type { ProjectContextValue } from "./ProjectContext.types"

import type { Character } from "@/types/character"
import type { Location } from "@/types/world/location"
import { createProject } from "@/lib/project"

import { generateStorySummary } from "@/components/ai/aiservice/aiService"

const ProjectContext =
  createContext<ProjectContextValue | null>(null)

// --------------------------------------------------
// Summary Fingerprint
// --------------------------------------------------

/**
 * Creates a deterministic representation of the
 * text/content of every scene in the manuscript.
 *
 * The story summary should only become stale when
 * actual scene text changes.
 *
 * Scene selection, scrolling, titles, synopsis,
 * POV, location, time, etc. do not affect this.
 */
function buildStorySummaryFingerprint(
  project: MnemeonaProject,
): string {
  const parts: string[] = []

  for (const act of project.manuscript.acts) {
    for (const chapter of act.chapters) {
      for (const scene of chapter.scenes) {
        parts.push(
          JSON.stringify({
            sceneId: scene.id,
            content: scene.content,
          }),
        )
      }
    }
  }

  /*
   * This is intentionally simple and deterministic.
   *
   * We do not need cryptographic security here.
   * We only need to know whether the scene text
   * has changed.
   */
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
    useState(() => createProject())

  const [summaryGenerating, setSummaryGenerating] =
    useState(false)

  /*
   * Stores the scene-text state from the previous
   * render so we can distinguish actual scene edits
   * from navigation and unrelated project changes.
   */
  const sceneTextFingerprintRef =
    useRef<string | null>(null)

  /*
   * Becomes true whenever scene text changes and
   * remains true until a summary is successfully
   * generated.
   */
  const scenesChangedSinceSummaryRef =
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
  // Story Summary
  // --------------------------------------------------

  const updateStorySummary = useCallback(
    async (
      targetProject: MnemeonaProject = project,
    ) => {
      const sceneId =
        targetProject.settings.activeSceneId

      if (!sceneId) {
        return
      }

      const targetScene =
        findScene(
          targetProject.manuscript.acts,
          sceneId,
        )

      if (!targetScene) {
        return
      }

      /*
       * The fingerprint represents the text/content
       * of every scene in the manuscript.
       */
      const currentFingerprint =
        buildStorySummaryFingerprint(
          targetProject,
        )

      /*
       * If the summary already represents this exact
       * scene-text state, there is nothing to do.
       *
       * This also protects against accidental duplicate
       * requests.
       */
      if (
        targetProject.storySummary?.trim() &&
        targetProject.storySummaryFingerprint ===
          currentFingerprint
      ) {
        scenesChangedSinceSummaryRef.current =
          false

        return
      }

      setSummaryGenerating(true)

      try {
        const summary =
          await generateStorySummary(
            targetProject,
            targetScene,
          )

        if (!summary.trim()) {
          return
        }

        setProject((current) => ({
          ...current,
          storySummary: summary,
          storySummaryFingerprint:
            currentFingerprint,
          updatedAt:
            new Date().toISOString(),
        }))

        /*
         * The summary now represents the latest
         * scene-text state.
         */
        scenesChangedSinceSummaryRef.current =
          false
      } catch (error) {
        /*
         * Keep the dirty flag set when generation fails.
         * The next scene change/save can retry.
         */
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
    ) =>
      projectActions.createNewProject(
        setProject,
        title,
      ),
    [],
  )

  const loadProject = useCallback(
    () =>
      projectActions.loadProject(
        setProject,
      ),
    [],
  )

  // --------------------------------------------------
  // Save Project
  // --------------------------------------------------

  const saveProject = useCallback(
    async () => {
      let projectToSave = project

      const sceneId =
        project.settings.activeSceneId

      if (sceneId) {
        const scene =
          findScene(
            project.manuscript.acts,
            sceneId,
          )

        if (scene) {
          const fingerprint =
            buildStorySummaryFingerprint(
              project,
            )

          /*
           * Only consider the summary stale when the
           * actual scene text differs from the text that
           * was used to create the summary.
           */
          const summaryIsCurrent =
            Boolean(
              project.storySummary?.trim(),
            ) &&
            project.storySummaryFingerprint ===
              fingerprint

          if (!summaryIsCurrent) {
            setSummaryGenerating(true)

            try {
              const summary =
                await generateStorySummary(
                  project,
                  scene,
                )

              if (summary.trim()) {
                projectToSave = {
                  ...project,
                  storySummary: summary,
                  storySummaryFingerprint:
                    fingerprint,
                  updatedAt:
                    new Date().toISOString(),
                }

                setProject(projectToSave)

                scenesChangedSinceSummaryRef.current =
                  false
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
  // Detect actual scene-text changes
  // --------------------------------------------------

  useEffect(() => {
    const currentFingerprint =
      buildStorySummaryFingerprint(
        project,
      )

    /*
     * First render/project load:
     *
     * Establish the baseline without marking the
     * project as edited.
     *
     * This prevents simply opening a project from
     * triggering a summary update.
     */
    if (
      sceneTextFingerprintRef.current === null
    ) {
      sceneTextFingerprintRef.current =
        currentFingerprint

      return
    }

    /*
     * Nothing about the scene text changed.
     *
     * This includes:
     * - changing active scene
     * - scrolling
     * - changing project metadata
     * - changing character/location data
     * - other unrelated project updates
     */
    if (
      sceneTextFingerprintRef.current ===
      currentFingerprint
    ) {
      return
    }

    /*
     * At least one scene's text/content changed.
     *
     * Keep this flag set until the summary is
     * successfully regenerated.
     */
    sceneTextFingerprintRef.current =
      currentFingerprint

    scenesChangedSinceSummaryRef.current =
      true
  }, [project])

  // --------------------------------------------------
  // Automatically update summary when scene changes
  // --------------------------------------------------

  useEffect(() => {
    if (!activeSceneId) {
      return
    }

    /*
     * Changing scenes is only a trigger opportunity.
     *
     * If no scene text has changed since the previous
     * summary, do absolutely nothing.
     */
    if (
      !scenesChangedSinceSummaryRef.current
    ) {
      return
    }

    void updateStorySummary(project)

    // Intentionally trigger only when the selected
    // scene changes.
    //
    // The scene-text detection effect above is
    // responsible for setting the pending flag.
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
    ],
  )

  return (
    <ProjectContext.Provider value={value}>
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
