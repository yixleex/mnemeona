import {
  MapPin,
  MessageSquare,
  Users,
  Link2,
  Eye,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import { useProject } from "@/context/ProjectContext"

import {
  buildSceneContext,
  formatStoryContext,
} from "@/components/ai/context/buildSceneContext"

interface AIContextPanelProps {
  onClose?: () => void
}

export function AIContextPanel({
  onClose,
}: AIContextPanelProps) {
  const {
    project,
    activeScene,
  } = useProject()

  if (!activeScene) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-xl font-semibold">
                AI Context
              </h1>

              <p className="text-sm text-muted-foreground">
                No active scene selected.
              </p>
            </div>
          </div>
        </div>

        {onClose && (
          <div className="p-6">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    )
  }

  const context = buildSceneContext(
    activeScene,
    project.characters,
    project.locations,
  )

  const formatted =
    formatStoryContext(context)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                AI Context
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                Context currently available to the AI for this scene.
              </p>
            </div>
          </div>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
          {/* Context summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Context Summary
              </h2>

              <p className="text-sm text-muted-foreground">
                What will currently be provided to the AI.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ContextStat
                icon={Users}
                label="Characters"
                value={formatted.characterCount}
              />

              <ContextStat
                icon={MapPin}
                label="Locations"
                value={formatted.locationCount}
              />

              <ContextStat
                icon={Link2}
                label="Relationships"
                value={formatted.relationshipCount}
              />

              <ContextStat
                icon={MessageSquare}
                label="Estimated Tokens"
                value={formatted.estimatedTokens}
              />
            </div>
          </section>

          {/* Detection */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Automatic Detection
              </h2>

              <p className="text-sm text-muted-foreground">
                References discovered directly in the scene text.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetectionCard
                icon={Users}
                label="Character References"
                value={
                  formatted.detectedCharacterCount
                }
              />

              <DetectionCard
                icon={MapPin}
                label="Location References"
                value={
                  formatted.detectedLocationCount
                }
              />
            </div>
          </section>

          {/* Scene */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Current Scene
              </h2>

              <p className="text-sm text-muted-foreground">
                The scene being used as the current AI context.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-medium">
                {activeScene.title}
              </h3>

              {activeScene.synopsis?.trim() && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {activeScene.synopsis.trim()}
                </p>
              )}

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {activeScene.pov?.trim() && (
                  <div>
                    <span className="text-muted-foreground">
                      POV
                    </span>

                    <p className="font-medium">
                      {activeScene.pov.trim()}
                    </p>
                  </div>
                )}

                {activeScene.location?.trim() && (
                  <div>
                    <span className="text-muted-foreground">
                      Location
                    </span>

                    <p className="font-medium">
                      {activeScene.location.trim()}
                    </p>
                  </div>
                )}

                {activeScene.time?.trim() && (
                  <div>
                    <span className="text-muted-foreground">
                      Time
                    </span>

                    <p className="font-medium">
                      {activeScene.time.trim()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Formatted context */}
          <section className="pb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Formatted AI Context
                </h2>

                <p className="text-sm text-muted-foreground">
                  This is the exact text currently produced by the
                  context formatter.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-4 w-4" />

                {formatted.estimatedTokens} tokens
              </div>
            </div>

            <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-5 font-mono text-xs leading-relaxed">
              {formatted.text}
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Components
// --------------------------------------------------

function ContextStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">
            {label}
          </p>

          <p className="text-lg font-semibold">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

function DetectionCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />

        <span className="text-sm">
          {label}
        </span>
      </div>

      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
        {value}
      </span>
    </div>
  )
}
