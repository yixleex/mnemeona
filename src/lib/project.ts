import type { MnemeonaProject } from "@/types/project"
import type { Manuscript } from "@/types/manuscript"

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
      createEmptyScene("Scene 1"),
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
      createEmptyChapter("Chapter 1"),
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
      createEmptyAct("Act I"),
    ],
  }
}

export function createProject(
  title = "Untitled Novel",
): MnemeonaProject {
  const now = new Date().toISOString()

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
    notes: [],

    storySummary: "",
    storySummaryFingerprint: "",

    settings: {
      activeSceneId:
        firstScene?.id ?? null,
    },
  }
}

export function downloadProject(
  project: MnemeonaProject,
) {
  const json = JSON.stringify(
    project,
    null,
    2,
  )

  const blob = new Blob([json], {
    type: "application/json",
  })

  const url =
    URL.createObjectURL(blob)

  const anchor =
    document.createElement("a")

  anchor.href = url

  anchor.download =
    `${project.title || "mnemeona-project"}.mnemeona.json`

  document.body.appendChild(anchor)

  anchor.click()

  anchor.remove()

  URL.revokeObjectURL(url)
}

export async function openProject(): Promise<MnemeonaProject | null> {
  const input =
    document.createElement("input")

  input.type = "file"

  input.accept =
    ".json,.mnemeona.json,application/json"

  return new Promise((resolve) => {
    input.onchange = async () => {
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
          JSON.parse(text) as Partial<MnemeonaProject>

        /*
         * Normalize older project files.
         *
         * Projects created before storySummary existed
         * will not have this property, so default it to
         * an empty string.
         */
        const project: MnemeonaProject = {
          ...parsed,
          storySummary:
            parsed.storySummary ?? "",
          storySummaryFingerprint:
            parsed.storySummaryFingerprint ?? "",
        } as MnemeonaProject

        resolve(project)
      } catch (error) {
        console.error(
          "Failed to open Mnemeona project:",
          error,
        )

        resolve(null)
      }
    }

    input.click()
  })
}
