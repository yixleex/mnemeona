import {
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Button } from "@/components/ui/button"

import { useProject } from "@/context/ProjectContext"

import type { Scene } from "@/types/manuscript"

import { createId } from "@/lib/project"

export function DraftSegment() {
  const {
    project,
    activeSceneId,
    activeSceneIsDraft,
    setActiveScene,
    updateProject,
  } = useProject()

  const draftScenes =
    project.manuscript
      .draftScenes ?? []

  const addDraftScene = () => {
    const scene: Scene = {
      id: createId(),

      title: `Draft ${draftScenes.length + 1}`,

      content: {
        type: "doc",

        content: [
          {
            type: "paragraph",
          },
        ],
      },

      synopsis: "",
      pov: "",
      characterIds: [],
      location: "",
      time: "",
      aiAdditionalContext: "",
    }

    updateProject(
      (currentProject) => ({
        ...currentProject,

        manuscript: {
          ...currentProject.manuscript,

          draftScenes: [
            ...(currentProject
              .manuscript
              .draftScenes ?? []),

            scene,
          ],
        },

        settings: {
          ...currentProject.settings,

          activeSceneId:
            scene.id,
        },

        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  const renameDraftScene = (
    sceneId: string,
    currentTitle: string,
  ) => {
    const title =
      window.prompt(
        "Rename draft",
        currentTitle,
      )

    if (!title?.trim()) {
      return
    }

    updateProject(
      (currentProject) => ({
        ...currentProject,

        manuscript: {
          ...currentProject.manuscript,

          draftScenes:
            (
              currentProject
                .manuscript
                .draftScenes ?? []
            ).map(
              (scene) =>
                scene.id ===
                sceneId
                  ? {
                      ...scene,
                      title:
                        title.trim(),
                    }
                  : scene,
            ),
        },

        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  const deleteDraftScene = (
    sceneId: string,
    title: string,
  ) => {
    if (
      !window.confirm(
        `Delete "${title}"?`,
      )
    ) {
      return
    }

    updateProject(
      (currentProject) => {
        const remaining =
          (
            currentProject
              .manuscript
              .draftScenes ?? []
          ).filter(
            (scene) =>
              scene.id !==
              sceneId,
          )

        const deletingActive =
          currentProject
            .settings
            .activeSceneId ===
          sceneId

        const fallback =
          deletingActive
            ? (
                currentProject
                  .manuscript
                  .acts
              ).flatMap(
                (act) =>
                  act.chapters,
              ).flatMap(
                (chapter) =>
                  chapter.scenes,
              )[0]?.id ??
              remaining[0]?.id ??
              null
            : currentProject
                .settings
                .activeSceneId

        return {
          ...currentProject,

          manuscript: {
            ...currentProject.manuscript,

            draftScenes:
              remaining,
          },

          settings: {
            ...currentProject.settings,

            activeSceneId:
              fallback,
          },

          updatedAt:
            new Date().toISOString(),
        }
      },
    )
  }

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Draft Segment
          </div>

          <div className="mt-0.5 text-[10px] text-muted-foreground/70">
            Independent scenes
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={addDraftScene}
          title="New draft"
          aria-label="New draft"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Draft scenes */}
      <div className="space-y-0.5">
        {draftScenes.map(
          (scene) => {
            const selected =
              activeSceneIsDraft &&
              scene.id ===
                activeSceneId

            return (
              <div
                key={scene.id}
                className="group flex items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveScene(
                      scene.id,
                    )
                  }
                  className={[
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5",
                    "text-left text-sm transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <FileText className="size-3.5 shrink-0" />

                  <span className="min-w-0 flex-1 truncate">
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
                      aria-label={`Actions for ${scene.title}`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        renameDraftScene(
                          scene.id,
                          scene.title,
                        )
                      }
                    >
                      <Pencil className="mr-2 size-4" />
                      Rename
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        deleteDraftScene(
                          scene.id,
                          scene.title,
                        )
                      }
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        )}

        {draftScenes.length ===
          0 && (
          <button
            type="button"
            onClick={
              addDraftScene
            }
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" />

            New independent scene
          </button>
        )}
      </div>
    </div>
  )
}
