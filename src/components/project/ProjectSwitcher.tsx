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
  Upload,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  type StoredProjectSummary,
} from "@/lib/projectDatabase"

export function ProjectSwitcher() {
  const {
    project,
    loadProject,
    saveProject,
    renameProject,
    updateProject,
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

  const handleOpenProject =
    async () => {
      await loadProject()
      await refreshProjectLibrary()
    }

  const handleSaveProject =
    () => {
      saveProject()
    }

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
          return
        }

        updateProject(
          () =>
            storedProject,
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

  const handleImportDatabase =
    async () => {
      const confirmed =
        window.confirm(
          "Importing a project database will replace the current local Mnemeona project database.\n\nContinue?",
        )

      if (!confirmed) {
        return
      }

      const importedProject =
        await importProjectDatabase()

      if (
        importedProject
      ) {
        updateProject(
          () =>
            importedProject,
        )

        await refreshProjectLibrary()
      }
    }

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
          className="w-72"
        >
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

          <DropdownMenuLabel className="flex items-center gap-2">
            <Library className="size-4" />

            Local Project Library
          </DropdownMenuLabel>

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
                <DropdownMenuItem
                  key={
                    stored.id
                  }
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
              ),
            )
          )}

          <DropdownMenuSeparator />

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

      <NewProjectDialog
        open={
          newProjectOpen
        }
        onOpenChange={
          setNewProjectOpen
        }
      />

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
