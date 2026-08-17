import type {
  Dispatch,
  SetStateAction,
} from "react"

import type { MnemeonaProject } from "@/types/project"

import {
  createProject,
  downloadProject,
  openProject,
} from "@/lib/project"

import {
  saveProjectToDatabase,
} from "@/lib/projectDatabase"

type SetProject = Dispatch<
  SetStateAction<MnemeonaProject>
>

// --------------------------------------------------
// Create
// --------------------------------------------------

export function createNewProject(
  setProject: SetProject,
  title = "Untitled Novel",
) {
  const project =
    createProject(title)

  setProject(project)

  // Store the new project immediately.
  void saveProjectToDatabase(
    project,
    true,
  )
}

// --------------------------------------------------
// Load individual JSON
// --------------------------------------------------

export async function loadProject(
  setProject: SetProject,
) {
  const loadedProject =
    await openProject()

  if (loadedProject) {
    setProject(
      loadedProject,
    )

    // openProject already stores it in IndexedDB.
  }
}

// --------------------------------------------------
// Save individual JSON
// --------------------------------------------------

export function saveProject(
  project: MnemeonaProject,
) {
  downloadProject(project)
}

// --------------------------------------------------
// Save to IndexedDB
// --------------------------------------------------

export async function saveProjectToDatabaseAction(
  project: MnemeonaProject,
) {
  await saveProjectToDatabase(
    project,
    true,
  )
}

// --------------------------------------------------
// Update
// --------------------------------------------------

export function updateProject(
  setProject: SetProject,
  updater: (
    project: MnemeonaProject,
  ) => MnemeonaProject,
) {
  setProject(
    (current) =>
      updater(current),
  )
}

// --------------------------------------------------
// Rename
// --------------------------------------------------

export function renameProject(
  setProject: SetProject,
  title: string,
) {
  const trimmedTitle =
    title.trim()

  if (!trimmedTitle) {
    return
  }

  setProject(
    (current) => ({
      ...current,

      title:
        trimmedTitle,

      updatedAt:
        new Date().toISOString(),
    }),
  )
}
