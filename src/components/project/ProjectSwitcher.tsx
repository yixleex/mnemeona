import { useState } from "react"

import {
  Check,
  ChevronDown,
  FilePlus,
  FolderOpen,
  Pencil,
  Save,
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

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useProject } from "@/context/ProjectContext"
import { NewProjectDialog } from "@/components/project/NewProjectDialog"

const RECENT_PROJECTS_KEY =
  "mnemeona-recent-projects"

interface RecentProject {
  id: string
  title: string
  updatedAt: string
}

function getRecentProjects(): RecentProject[] {
  try {
    const stored = localStorage.getItem(
      RECENT_PROJECTS_KEY,
    )

    if (!stored) {
      return []
    }

    return JSON.parse(
      stored,
    ) as RecentProject[]
  } catch {
    return []
  }
}

function saveRecentProject(
  project: RecentProject,
) {
  const existing = getRecentProjects()

  const updated = [
    project,
    ...existing.filter(
      (item) => item.id !== project.id,
    ),
  ].slice(0, 5)

  localStorage.setItem(
    RECENT_PROJECTS_KEY,
    JSON.stringify(updated),
  )
}

export function ProjectSwitcher() {
  const {
    project,
    loadProject,
    saveProject,
    renameProject,
  } = useProject()

  const [newProjectOpen, setNewProjectOpen] =
    useState(false)

  const [renameProjectOpen, setRenameProjectOpen] =
    useState(false)

  const [projectName, setProjectName] =
    useState(project.title)

  const handleOpenProject = async () => {
    await loadProject()
  }

  const handleSaveProject = () => {
    saveProject()

    saveRecentProject({
      id: project.id,
      title: project.title,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleOpenRename = () => {
    setProjectName(project.title)
    setRenameProjectOpen(true)
  }

  const handleRenameProject = () => {
    const trimmedName =
      projectName.trim()

    if (!trimmedName) {
      return
    }

    renameProject(trimmedName)
    setRenameProjectOpen(false)
  }

  const recentProjects =
    getRecentProjects()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="max-w-64 gap-2 px-2"
          >
            <span className="truncate">
              {project.title}
            </span>

            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-64"
        >
          <DropdownMenuItem
            onClick={() =>
              setNewProjectOpen(true)
            }
          >
            <FilePlus className="mr-2 size-4" />
            New Project
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleOpenProject}
          >
            <FolderOpen className="mr-2 size-4" />
            Open Project...
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleSaveProject}
          >
            <Save className="mr-2 size-4" />
            Save Project
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleOpenRename}
          >
            <Pencil className="mr-2 size-4" />
            Rename Project
          </DropdownMenuItem>

          {recentProjects.length > 0 && (
            <>
              <DropdownMenuSeparator />

              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Recent Projects
              </div>

              {recentProjects.map(
                (recent) => (
                  <DropdownMenuItem
                    key={recent.id}
                    disabled={
                      recent.id ===
                      project.id
                    }
                  >
                    <span className="truncate">
                      {recent.title}
                    </span>

                    {recent.id ===
                      project.id && (
                      <Check className="ml-auto size-4" />
                    )}
                  </DropdownMenuItem>
                ),
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={
          setNewProjectOpen
        }
      />

      <Dialog
        open={renameProjectOpen}
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
            value={projectName}
            onChange={(event) =>
              setProjectName(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter"
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
