import type { MnemeonaProject } from "@/types/project"
import type { Manuscript } from "@/types/manuscript"

import {
  importProjectIntoDatabase,
} from "./projectDatabase"

export function createId(): string {
  return crypto.randomUUID()
}

function createEmptyScene(
  title = "Scene 1",
) {
  return {
    id: createId(),
    title,

    content: {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
        },
      ],
    },

    synopsis: "",
    pov: "",
    location: "",
    time: "",
    characterIds: [],
  }
}

function createEmptyChapter(
  title = "Chapter 1",
) {
  return {
    id: createId(),
    title,

    synopsis: "",

    scenes: [
      createEmptyScene(
        "Scene 1",
      ),
    ],
  }
}

function createEmptyAct(
  title = "Act I",
) {
  return {
    id: createId(),
    title,

    synopsis: "",

    chapters: [
      createEmptyChapter(
        "Chapter 1",
      ),
    ],
  }
}

export function createManuscript(
  title = "Untitled Novel",
): Manuscript {
  return {
    id: createId(),
    title,

    acts: [
      createEmptyAct(
        "Act I",
      ),
    ],
  }
}

export function createProject(
  title = "Untitled Novel",
): MnemeonaProject {
  const now =
    new Date().toISOString()

  const manuscript =
    createManuscript(title)

  const firstScene =
    manuscript.acts[0]
      ?.chapters[0]
      ?.scenes[0]

  return {
    id: createId(),
    title,

    createdAt: now,
    updatedAt: now,

    manuscript,

    characters: [],

    locations: [],
    events: [],
    factions: [],

    notes: [],

    storySummary: "",
    storySummaryFingerprint:
      "",

    settings: {
      activeSceneId:
        firstScene?.id ??
        null,
    },
  }
}

/**
 * Export one project as a portable JSON file.
 *
 * This remains intentionally separate from the IndexedDB
 * database export.
 */
export function downloadProject(
  project: MnemeonaProject,
) {
  const json =
    JSON.stringify(
      project,
      null,
      2,
    )

  const blob =
    new Blob([json], {
      type:
        "application/json",
    })

  const url =
    URL.createObjectURL(
      blob,
    )

  const anchor =
    document.createElement(
      "a",
    )

  anchor.href = url

  anchor.download =
    `${
      project.title ||
      "mnemeona-project"
    }.mnemeona.json`

  document.body.appendChild(
    anchor,
  )

  anchor.click()

  anchor.remove()

  URL.revokeObjectURL(
    url,
  )
}

/**
 * Open one individual .mnemeona.json project.
 *
 * Older project files are automatically migrated
 * by providing missing world collections as empty arrays.
 *
 * The imported project is also placed into IndexedDB and
 * becomes the active local project.
 */
export async function openProject(): Promise<
  MnemeonaProject | null
> {
  const input =
    document.createElement(
      "input",
    )

  input.type = "file"

  input.accept =
    ".json,.mnemeona.json,application/json"

  return new Promise(
    (resolve) => {
      input.onchange =
        async () => {
          const file =
            input.files?.[0]

          if (!file) {
            resolve(null)
            return
          }

          try {
            const text =
              await file.text()

            const parsed =
              JSON.parse(
                text,
              ) as Partial<MnemeonaProject>

            const project: MnemeonaProject =
              {
                ...parsed,

                storySummary:
                  parsed.storySummary ??
                  "",

                storySummaryFingerprint:
                  parsed.storySummaryFingerprint ??
                  "",

                characters:
                  parsed.characters ??
                  [],

                locations:
                  parsed.locations ??
                  [],

                events:
                  parsed.events ??
                  [],

                factions:
                  parsed.factions ??
                  [],

                notes:
                  parsed.notes ??
                  [],
              } as MnemeonaProject

            await importProjectIntoDatabase(
              project,
            )

            resolve(project)
          } catch (error) {
            console.error(
              "Failed to open Mnemeona project:",
              error,
            )

            window.alert(
              `Could not open project.\n\n${
                error instanceof Error
                  ? error.message
                  : "Unknown error"
              }`,
            )

            resolve(null)
          }
        }

      input.click()
    },
  )
}
