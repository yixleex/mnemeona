import {
  useEffect,
  useState,
} from "react"

import {
  Check,
  ChevronDown,
  Download,
  FilePlus,
  FolderOpen,
  Library,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Button,
} from "@/components/ui/button"

import {
  Input,
} from "@/components/ui/input"

import {
  useProject,
} from "@/context/ProjectContext"

import {
  NewProjectDialog,
} from "@/components/project/NewProjectDialog"

import {
  getCurrentProjectId,
  getProjectFromDatabase,
  importProjectDatabase,
  listProjectsFromDatabase,
  exportProjectDatabase,
  deleteProjectFromDatabase,
  type StoredProjectSummary,
} from "@/lib/projectDatabase"

export function ProjectSwitcher() {
  const {
    project,
    loadProject,
    saveProject,
    renameProject,
    updateProject,
    createNewProject,
  } = useProject()

  const [
    newProjectOpen,
    setNewProjectOpen,
  ] = useState(false)

  const [
    renameProjectOpen,
    setRenameProjectOpen,
  ] = useState(false)

  const [
    projectName,
    setProjectName,
  ] = useState(
    project.title,
  )

  const [
    storedProjects,
    setStoredProjects,
  ] = useState<
    StoredProjectSummary[]
  >([])

  const [
    currentProjectId,
    setCurrentProjectId,
  ] = useState<
    string | null
  >(null)

  const refreshProjectLibrary =
    async () => {
      try {
        const [
          projects,
          activeId,
        ] = await Promise.all([
          listProjectsFromDatabase(),
          getCurrentProjectId(),
        ])

        setStoredProjects(
          projects,
        )

        setCurrentProjectId(
          activeId,
        )
      } catch (error) {
        console.error(
          "Failed to load project library:",
          error,
        )
      }
    }

  useEffect(() => {
    void refreshProjectLibrary()

    const handleDatabaseChange =
      () => {
        void refreshProjectLibrary()
      }

    window.addEventListener(
      "mnemeona:project-database-changed",
      handleDatabaseChange,
    )

    return () => {
      window.removeEventListener(
        "mnemeona:project-database-changed",
        handleDatabaseChange,
      )
    }
  }, [])

  // --------------------------------------------------
  // Open project JSON
  // --------------------------------------------------

  const handleOpenProject =
    async () => {
      try {
        await loadProject()
        await refreshProjectLibrary()
      } catch (error) {
        console.error(
          "Failed to open project:",
          error,
        )

        window.alert(
          `Could not open project.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Save project JSON
  // --------------------------------------------------

  const handleSaveProject =
    () => {
      try {
        void saveProject()
      } catch (error) {
        console.error(
          "Failed to save project:",
          error,
        )

        window.alert(
          `Could not export project.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Open stored project
  // --------------------------------------------------

  const handleOpenStoredProject =
    async (
      projectId: string,
    ) => {
      try {
        const storedProject =
          await getProjectFromDatabase(
            projectId,
          )

        if (!storedProject) {
          window.alert(
            "That project could not be found in the local project database.",
          )

          await refreshProjectLibrary()

          return
        }

        updateProject(
          () =>
            storedProject,
        )

        setCurrentProjectId(
          storedProject.id,
        )

        await refreshProjectLibrary()
      } catch (error) {
        console.error(
          "Failed to load stored project:",
          error,
        )

        window.alert(
          `Could not load project.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Delete stored project
  // --------------------------------------------------

  const handleDeleteStoredProject =
    async (
      projectId: string,
      projectTitle: string,
    ) => {
      const confirmed =
        window.confirm(
          `Delete "${projectTitle}" from the local project database?\n\nThis cannot be undone unless you have exported a project database backup.`,
        )

      if (!confirmed) {
        return
      }

      try {
        const isCurrentProject =
          projectId ===
          currentProjectId

        /*
         * If we're deleting the active project, select a
         * replacement BEFORE deleting it.
         *
         * This prevents ProjectContext's autosave from
         * immediately recreating the deleted project.
         */
        if (isCurrentProject) {
          const replacement =
            storedProjects.find(
              (
                stored,
              ) =>
                stored.id !==
                projectId,
            )

          if (replacement) {
            const replacementProject =
              await getProjectFromDatabase(
                replacement.id,
              )

            if (
              replacementProject
            ) {
              updateProject(
                () =>
                  replacementProject,
              )

              setCurrentProjectId(
                replacement.id,
              )
            }
          } else {
            /*
             * This was the last project.
             *
             * Create a fresh project in React state. The
             * normal ProjectContext autosave will persist it.
             */
            createNewProject(
              "Untitled Novel",
            )

            setCurrentProjectId(
              null,
            )
          }
        }

        await deleteProjectFromDatabase(
          projectId,
        )

        await refreshProjectLibrary()
      } catch (error) {
        console.error(
          "Failed to delete stored project:",
          error,
        )

        window.alert(
          `Could not delete project.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Export database
  // --------------------------------------------------

  const handleExportDatabase =
    async () => {
      try {
        await exportProjectDatabase()
      } catch (error) {
        console.error(
          "Failed to export project database:",
          error,
        )

        window.alert(
          `Could not export project database.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Import database
  // --------------------------------------------------

  const handleImportDatabase =
    async () => {
      const confirmed =
        window.confirm(
          "Importing a project database will replace the current local Mnemeona project database.\n\nContinue?",
        )

      if (!confirmed) {
        return
      }

      try {
        const importedProject =
          await importProjectDatabase()

        if (
          importedProject
        ) {
          updateProject(
            () =>
              importedProject,
          )

          setCurrentProjectId(
            importedProject.id,
          )

          await refreshProjectLibrary()
        }
      } catch (error) {
        console.error(
          "Failed to import project database:",
          error,
        )

        window.alert(
          `Could not import project database.\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
        )
      }
    }

  // --------------------------------------------------
  // Rename
  // --------------------------------------------------

  const handleOpenRename =
    () => {
      setProjectName(
        project.title,
      )

      setRenameProjectOpen(
        true,
      )
    }

  const handleRenameProject =
    () => {
      const trimmedName =
        projectName.trim()

      if (!trimmedName) {
        return
      }

      renameProject(
        trimmedName,
      )

      setRenameProjectOpen(
        false,
      )
    }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
        >
          <Button
            variant="ghost"
            className="max-w-64 gap-2 px-2"
          >
            <span className="truncate">
              {
                project.title
              }
            </span>

            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-80"
        >
          {/* ---------------------------------------- */}
          {/* Project actions */}
          {/* ---------------------------------------- */}

          <DropdownMenuItem
            onClick={() =>
              setNewProjectOpen(
                true,
              )
            }
          >
            <FilePlus className="mr-2 size-4" />

            New Project
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={
              handleOpenProject
            }
          >
            <FolderOpen className="mr-2 size-4" />

            Open Project File...
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={
              handleSaveProject
            }
          >
            <Save className="mr-2 size-4" />

            Export Project JSON
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* ---------------------------------------- */}
          {/* Local project library */}
          {/* ---------------------------------------- */}

          <div className="flex items-center gap-2 px-1.5 py-1 text-xs font-medium text-muted-foreground">
            <Library className="size-4" />

            Local Project Library
          </div>

          {storedProjects.length ===
          0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No stored projects yet.
            </div>
          ) : (
            storedProjects.map(
              (
                stored,
              ) => (
                <div
                  key={
                    stored.id
                  }
                  className="group flex min-w-0 items-center"
                >
                  <DropdownMenuItem
                    className="min-w-0 flex-1 pr-1"
                    onClick={() =>
                      void handleOpenStoredProject(
                        stored.id,
                      )
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {
                        stored.title
                      }
                    </span>

                    {stored.id ===
                      currentProjectId && (
                      <Check className="ml-2 size-4 shrink-0" />
                    )}
                  </DropdownMenuItem>

                  <button
                    type="button"
                    aria-label={`Delete ${stored.title}`}
                    title={`Delete ${stored.title}`}
                    className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
                    onClick={(
                      event,
                    ) => {
                      event.stopPropagation()

                      void handleDeleteStoredProject(
                        stored.id,
                        stored.title,
                      )
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ),
            )
          )}

          <DropdownMenuSeparator />

          {/* ---------------------------------------- */}
          {/* Database backup */}
          {/* ---------------------------------------- */}

          <DropdownMenuItem
            onClick={
              handleExportDatabase
            }
          >
            <Download className="mr-2 size-4" />

            Export Project Database
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={
              handleImportDatabase
            }
          >
            <Upload className="mr-2 size-4" />

            Import Project Database
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* ---------------------------------------- */}
          {/* Rename */}
          {/* ---------------------------------------- */}

          <DropdownMenuItem
            onClick={
              handleOpenRename
            }
          >
            <Pencil className="mr-2 size-4" />

            Rename Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* -------------------------------------------- */}
      {/* New project */}
      {/* -------------------------------------------- */}

      <NewProjectDialog
        open={
          newProjectOpen
        }
        onOpenChange={
          setNewProjectOpen
        }
      />

      {/* -------------------------------------------- */}
      {/* Rename */}
      {/* -------------------------------------------- */}

      <Dialog
        open={
          renameProjectOpen
        }
        onOpenChange={
          setRenameProjectOpen
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rename Project
            </DialogTitle>

            <DialogDescription>
              Choose a new name for your
              project.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={
              projectName
            }
            onChange={(
              event,
            ) =>
              setProjectName(
                event.target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                handleRenameProject()
              }
            }}
            placeholder="Project name"
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRenameProjectOpen(
                  false,
                )
              }
            >
              Cancel
            </Button>

            <Button
              onClick={
                handleRenameProject
              }
              disabled={
                !projectName.trim()
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
