import type { MnemeonaProject } from "@/types/project"

const DATABASE_NAME = "mnemeona"
const DATABASE_VERSION = 1

const PROJECTS_STORE = "projects"
const META_STORE = "meta"

const CURRENT_PROJECT_KEY = "currentProjectId"

export interface StoredProjectSummary {
  id: string
  title: string
  updatedAt: string
}

export interface ProjectDatabaseBackup {
  format: "mnemeona-project-database"
  version: 1
  exportedAt: string
  currentProjectId: string | null
  projects: MnemeonaProject[]
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(
        new Error(
          "IndexedDB is not available in this browser.",
        ),
      )

      return
    }

    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION,
    )

    request.onerror = () => {
      reject(
        request.error ??
          new Error(
            "Failed to open Mnemeona database.",
          ),
      )
    }

    request.onupgradeneeded = () => {
      const database =
        request.result

      if (
        !database.objectStoreNames.contains(
          PROJECTS_STORE,
        )
      ) {
        database.createObjectStore(
          PROJECTS_STORE,
          {
            keyPath: "id",
          },
        )
      }

      if (
        !database.objectStoreNames.contains(
          META_STORE,
        )
      ) {
        database.createObjectStore(
          META_STORE,
          {
            keyPath: "key",
          },
        )
      }
    }

    request.onsuccess = () => {
      const database =
        request.result

      database.onversionchange = () => {
        database.close()
      }

      resolve(database)
    }
  })
}

function requestToPromise<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise(
    (resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(
          request.error ??
            new Error(
              "IndexedDB request failed.",
            ),
        )
      }
    },
  )
}

function transactionToPromise(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      transaction.oncomplete = () => {
        resolve()
      }

      transaction.onerror = () => {
        reject(
          transaction.error ??
            new Error(
              "IndexedDB transaction failed.",
            ),
        )
      }

      transaction.onabort = () => {
        reject(
          transaction.error ??
            new Error(
              "IndexedDB transaction was aborted.",
            ),
        )
      }
    },
  )
}

/**
 * Dispatches a local browser event so UI components can
 * refresh their project lists without polling IndexedDB.
 */
function notifyDatabaseChanged() {
  window.dispatchEvent(
    new CustomEvent(
      "mnemeona:project-database-changed",
    ),
  )
}

/**
 * Store/update a project in IndexedDB.
 *
 * If makeCurrent is true, this project also becomes
 * the project restored on the next application startup.
 */
export async function saveProjectToDatabase(
  project: MnemeonaProject,
  makeCurrent = true,
): Promise<void> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        [
          PROJECTS_STORE,
          META_STORE,
        ],
        "readwrite",
      )

    const projects =
      transaction.objectStore(
        PROJECTS_STORE,
      )

    const meta =
      transaction.objectStore(
        META_STORE,
      )

    projects.put(project)

    if (makeCurrent) {
      meta.put({
        key: CURRENT_PROJECT_KEY,
        value: project.id,
      })
    }

    await transactionToPromise(
      transaction,
    )

    notifyDatabaseChanged()
  } finally {
    database.close()
  }
}

export async function getProjectFromDatabase(
  projectId: string,
): Promise<MnemeonaProject | null> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        PROJECTS_STORE,
        "readonly",
      )

    const request =
      transaction
        .objectStore(
          PROJECTS_STORE,
        )
        .get(projectId)

    const result =
      await requestToPromise(
        request,
      )

    return (
      result ??
      null
    )
  } finally {
    database.close()
  }
}

export async function getCurrentProjectId(): Promise<
  string | null
> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        META_STORE,
        "readonly",
      )

    const request =
      transaction
        .objectStore(
          META_STORE,
        )
        .get(CURRENT_PROJECT_KEY)

    const result =
      await requestToPromise(
        request,
      )

    if (
      !result ||
      typeof result.value !==
        "string"
    ) {
      return null
    }

    return result.value
  } finally {
    database.close()
  }
}

export async function getCurrentProject(): Promise<
  MnemeonaProject | null
> {
  const projectId =
    await getCurrentProjectId()

  if (!projectId) {
    return null
  }

  return getProjectFromDatabase(
    projectId,
  )
}

export async function listProjectsFromDatabase(): Promise<
  StoredProjectSummary[]
> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        PROJECTS_STORE,
        "readonly",
      )

    const request =
      transaction
        .objectStore(
          PROJECTS_STORE,
        )
        .getAll()

    const projects =
      await requestToPromise(
        request,
      )

    return (
      projects as MnemeonaProject[]
    )
      .map(
        (
          project,
        ) => ({
          id: project.id,
          title:
            project.title ||
            "Untitled Novel",
          updatedAt:
            project.updatedAt,
        }),
      )
      .sort(
        (a, b) =>
          new Date(
            b.updatedAt,
          ).getTime() -
          new Date(
            a.updatedAt,
          ).getTime(),
      )
  } finally {
    database.close()
  }
}

/**
 * Export the entire local project database as one JSON file.
 */
export async function exportProjectDatabase(): Promise<void> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        [
          PROJECTS_STORE,
          META_STORE,
        ],
        "readonly",
      )

    const projectsRequest =
      transaction
        .objectStore(
          PROJECTS_STORE,
        )
        .getAll()

    const currentProjectRequest =
      transaction
        .objectStore(
          META_STORE,
        )
        .get(CURRENT_PROJECT_KEY)

    const [
      projects,
      currentProject,
    ] =
      await Promise.all([
        requestToPromise(
          projectsRequest,
        ),
        requestToPromise(
          currentProjectRequest,
        ),
      ])

    const backup: ProjectDatabaseBackup =
      {
        format:
          "mnemeona-project-database",
        version: 1,
        exportedAt:
          new Date().toISOString(),
        currentProjectId:
          currentProject?.value ??
          null,
        projects:
          projects as MnemeonaProject[],
      }

    const json =
      JSON.stringify(
        backup,
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
      `mnemeona-database-${new Date()
        .toISOString()
        .slice(0, 10)}.mnemeona-db.json`

    document.body.appendChild(
      anchor,
    )

    anchor.click()

    anchor.remove()

    URL.revokeObjectURL(
      url,
    )
  } finally {
    database.close()
  }
}

/**
 * Open a complete Mnemeona database backup and replace
 * the current local IndexedDB database with its contents.
 *
 * Returns the project that should become active.
 */
export async function importProjectDatabase(): Promise<
  MnemeonaProject | null
> {
  const input =
    document.createElement(
      "input",
    )

  input.type = "file"

  input.accept =
    ".json,.mnemeona-db.json,application/json"

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
              ) as Partial<ProjectDatabaseBackup>

            if (
              parsed.format !==
              "mnemeona-project-database"
            ) {
              throw new Error(
                "This file is not a Mnemeona project database backup.",
              )
            }

            if (
              parsed.version !==
              1
            ) {
              throw new Error(
                `Unsupported Mnemeona database backup version: ${String(
                  parsed.version,
                )}`,
              )
            }

            if (
              !Array.isArray(
                parsed.projects,
              )
            ) {
              throw new Error(
                "The database backup does not contain a valid project list.",
              )
            }

            const projects =
              parsed.projects as MnemeonaProject[]

            for (const project of projects) {
              if (
                !project ||
                typeof project.id !==
                  "string" ||
                typeof project.title !==
                  "string" ||
                !project.manuscript
              ) {
                throw new Error(
                  "The database backup contains an invalid project.",
                )
              }
            }

            const database =
              await openDatabase()

            try {
              const transaction =
                database.transaction(
                  [
                    PROJECTS_STORE,
                    META_STORE,
                  ],
                  "readwrite",
                )

              const projectStore =
                transaction.objectStore(
                  PROJECTS_STORE,
                )

              const metaStore =
                transaction.objectStore(
                  META_STORE,
                )

              projectStore.clear()

              for (const project of projects) {
                projectStore.put(
                  project,
                )
              }

              const requestedCurrentId =
                parsed.currentProjectId

              const currentProject =
                projects.find(
                  (
                    project,
                  ) =>
                    project.id ===
                    requestedCurrentId,
                ) ??
                projects[0] ??
                null

              if (currentProject) {
                metaStore.put({
                  key:
                    CURRENT_PROJECT_KEY,
                  value:
                    currentProject.id,
                })
              } else {
                metaStore.delete(
                  CURRENT_PROJECT_KEY,
                )
              }

              await transactionToPromise(
                transaction,
              )

              notifyDatabaseChanged()

              resolve(
                currentProject,
              )
            } finally {
              database.close()
            }
          } catch (error) {
            console.error(
              "Failed to import Mnemeona project database:",
              error,
            )

            window.alert(
              `Could not import project database.\n\n${
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

/**
 * Import a single project into the local database.
 */
export async function importProjectIntoDatabase(
  project: MnemeonaProject,
): Promise<void> {
  await saveProjectToDatabase(
    project,
    true,
  )
}

/**
 * Delete a project from the local database.
 */
export async function deleteProjectFromDatabase(
  projectId: string,
): Promise<void> {
  const database =
    await openDatabase()

  try {
    const transaction =
      database.transaction(
        [
          PROJECTS_STORE,
          META_STORE,
        ],
        "readwrite",
      )

    transaction
      .objectStore(
        PROJECTS_STORE,
      )
      .delete(projectId)

    const meta =
      transaction.objectStore(
        META_STORE,
      )

    const current =
      await requestToPromise(
        meta.get(
          CURRENT_PROJECT_KEY,
        ),
      )

    if (
      current?.value ===
      projectId
    ) {
      meta.delete(
        CURRENT_PROJECT_KEY,
      )
    }

    await transactionToPromise(
      transaction,
    )

    notifyDatabaseChanged()
  } finally {
    database.close()
  }
}
