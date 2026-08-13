import type { Dispatch, SetStateAction } from "react"

import type { MnemeonaProject } from "@/types/project"

import {
  createProject,
  downloadProject,
  openProject,
} from "@/lib/project"

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
  setProject(
    createProject(title),
  )
}

// --------------------------------------------------
// Load
// --------------------------------------------------

export async function loadProject(
  setProject: SetProject,
) {
  const loadedProject =
    await openProject()

  if (loadedProject) {
    setProject(loadedProject)
  }
}

// --------------------------------------------------
// Save
// --------------------------------------------------

export function saveProject(
  project: MnemeonaProject,
) {
  downloadProject(project)
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
  setProject((current) =>
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

  setProject((current) => ({
    ...current,

    title: trimmedTitle,

    updatedAt:
      new Date().toISOString(),
  }))
}
