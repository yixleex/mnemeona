import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Button } from "@/components/ui/button"

import type {
  Act,
  Chapter,
} from "@/types/manuscript"

import { useProject } from "@/context/ProjectContext"

type ManuscriptTreeProps = {
  active?: boolean
  onSceneSelect?: () => void
}

export function ManuscriptTree({
  active = true,
  onSceneSelect,
}: ManuscriptTreeProps) {
  const {
    project,
    activeSceneId,
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
  } = useProject()

  const { acts } = project.manuscript

  return (
    <div>
      {/* Manuscript header */}
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Manuscript
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={addAct}
          title="New act"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Acts */}
      {acts.map((act) => (
        <ActNode
          key={act.id}
          act={act}
          activeSceneId={activeSceneId}
          active={active}
          onSceneSelect={setActiveScene}
          onSceneWorkspaceSelect={() =>
            onSceneSelect?.()
          }
          onAddChapter={addChapter}
          onAddScene={addScene}
          onRenameAct={renameAct}
          onRenameChapter={renameChapter}
          onRenameScene={renameScene}
          onDeleteAct={deleteAct}
          onDeleteChapter={deleteChapter}
          onDeleteScene={deleteScene}
        />
      ))}

      {/* Empty state */}
      {acts.length === 0 && (
        <button
          onClick={addAct}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
          Create your first act
        </button>
      )}
    </div>
  )
}

type ActNodeProps = {
  act: Act
  activeSceneId: string | null
  active: boolean

  onSceneSelect: (
    sceneId: string | null,
  ) => void

  onSceneWorkspaceSelect: () => void

  onAddChapter: (
    actId: string,
  ) => void

  onAddScene: (
    actId: string,
    chapterId: string,
  ) => void

  onRenameAct: (
    actId: string,
    title: string,
  ) => void

  onRenameChapter: (
    actId: string,
    chapterId: string,
    title: string,
  ) => void

  onRenameScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
    title: string,
  ) => void

  onDeleteAct: (
    actId: string,
  ) => void

  onDeleteChapter: (
    actId: string,
    chapterId: string,
  ) => void

  onDeleteScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
  ) => void
}

function ActNode({
  act,
  activeSceneId,
  active,
  onSceneSelect,
  onSceneWorkspaceSelect,
  onAddChapter,
  onAddScene,
  onRenameAct,
  onRenameChapter,
  onRenameScene,
  onDeleteAct,
  onDeleteChapter,
  onDeleteScene,
}: ActNodeProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="group">
      <div className="flex items-center">
        <button
          onClick={() =>
            setOpen((value) => !value)
          }
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-accent"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}

          <Folder className="size-4 shrink-0 text-muted-foreground" />

          <span className="truncate">
            {act.title}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const title = window.prompt(
                  "Rename act",
                  act.title,
                )

                if (title?.trim()) {
                  onRenameAct(
                    act.id,
                    title.trim(),
                  )
                }
              }}
            >
              <Pencil className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                onAddChapter(act.id)
              }
            >
              <Plus className="mr-2 size-4" />
              New chapter
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${act.title}" and all of its chapters and scenes?`,
                  )
                ) {
                  onDeleteAct(act.id)
                }
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="ml-4 border-l pl-2">
          {act.chapters.map((chapter) => (
            <ChapterNode
              key={chapter.id}
              actId={act.id}
              chapter={chapter}
              activeSceneId={activeSceneId}
              active={active}
              onSceneSelect={onSceneSelect}
              onSceneWorkspaceSelect={
                onSceneWorkspaceSelect
              }
              onAddScene={onAddScene}
              onRenameChapter={
                onRenameChapter
              }
              onRenameScene={onRenameScene}
              onDeleteChapter={
                onDeleteChapter
              }
              onDeleteScene={
                onDeleteScene
              }
            />
          ))}

          <button
            onClick={() =>
              onAddChapter(act.id)
            }
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New chapter
          </button>
        </div>
      )}
    </div>
  )
}

type ChapterNodeProps = {
  actId: string
  chapter: Chapter
  activeSceneId: string | null
  active: boolean

  onSceneSelect: (
    sceneId: string | null,
  ) => void

  onSceneWorkspaceSelect: () => void

  onAddScene: (
    actId: string,
    chapterId: string,
  ) => void

  onRenameChapter: (
    actId: string,
    chapterId: string,
    title: string,
  ) => void

  onRenameScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
    title: string,
  ) => void

  onDeleteChapter: (
    actId: string,
    chapterId: string,
  ) => void

  onDeleteScene: (
    actId: string,
    chapterId: string,
    sceneId: string,
  ) => void
}

function ChapterNode({
  actId,
  chapter,
  activeSceneId,
  active,
  onSceneSelect,
  onSceneWorkspaceSelect,
  onAddScene,
  onRenameChapter,
  onRenameScene,
  onDeleteChapter,
  onDeleteScene,
}: ChapterNodeProps) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div className="group flex items-center">
        <button
          onClick={() =>
            setOpen((value) => !value)
          }
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}

          <span className="truncate">
            {chapter.title}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const title =
                  window.prompt(
                    "Rename chapter",
                    chapter.title,
                  )

                if (title?.trim()) {
                  onRenameChapter(
                    actId,
                    chapter.id,
                    title.trim(),
                  )
                }
              }}
            >
              <Pencil className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                onAddScene(
                  actId,
                  chapter.id,
                )
              }
            >
              <Plus className="mr-2 size-4" />
              New scene
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${chapter.title}" and all of its scenes?`,
                  )
                ) {
                  onDeleteChapter(
                    actId,
                    chapter.id,
                  )
                }
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="ml-4">
          {chapter.scenes.map((scene) => {
            /*
             * A scene is visually selected only when
             * the manuscript workspace is active.
             */
            const selected =
              active &&
              scene.id === activeSceneId

            return (
              <div
                key={scene.id}
                className="group flex items-center gap-1"
              >
                <button
                  onClick={() => {
                    /*
                     * First update the active scene,
                     * then switch the center workspace
                     * back to the manuscript editor.
                     */
                    onSceneSelect(scene.id)
                    onSceneWorkspaceSelect()
                  }}
                  className={[
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5",
                    "text-left text-sm transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <FileText className="size-3.5 shrink-0" />

                  <span className="truncate">
                    {scene.title}
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const title =
                          window.prompt(
                            "Rename scene",
                            scene.title,
                          )

                        if (title?.trim()) {
                          onRenameScene(
                            actId,
                            chapter.id,
                            scene.id,
                            title.trim(),
                          )
                        }
                      }}
                    >
                      <Pencil className="mr-2 size-4" />
                      Rename
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${scene.title}"?`,
                          )
                        ) {
                          onDeleteScene(
                            actId,
                            chapter.id,
                            scene.id,
                          )
                        }
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}

          <button
            onClick={() =>
              onAddScene(
                actId,
                chapter.id,
              )
            }
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />
            New scene
          </button>
        </div>
      )}
    </div>
  )
}
