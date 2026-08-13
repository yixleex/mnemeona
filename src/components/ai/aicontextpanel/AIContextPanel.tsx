import {
  MapPin,
  MessageSquare,
  Users,
  Link2,
  Eye,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

import { useEffect, useState } from "react"

import { useProject } from "@/context/ProjectContext"

import {
  buildSceneContext,
  formatStoryContext,
} from "@/components/ai/context/buildSceneContext"

import {
  loadContinueWritingLength,
  loadSceneAIContext,
  saveContinueWritingLength,
  saveSceneAIContext,
} from "@/components/ai/aiservice/aiService"

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

  const [
    continueWritingLength,
    setContinueWritingLength,
  ] = useState(
    loadContinueWritingLength(),
  )

  const [
    sceneAIContext,
    setSceneAIContext,
  ] = useState("")

  /*
   * Load scene-specific AI instructions
   * whenever the active scene changes.
   */
  useEffect(() => {
    if (!activeScene) {
      setSceneAIContext("")
      return
    }

    setSceneAIContext(
      loadSceneAIContext(
        activeScene.id,
      ),
    )
  }, [
    activeScene?.id,
  ])

  /*
   * Load the saved Continue AI response
   * length.
   */
  useEffect(() => {
    setContinueWritingLength(
      loadContinueWritingLength(),
    )
  }, [])

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

  /*
   * This is the authoritative context builder.
   *
   * Do not recreate character, location,
   * relationship, or scene context here.
   */
  const context =
    buildSceneContext(
      activeScene,
      project.characters,
      project.locations,
    )

  /*
   * This is the exact formatter used to turn
   * the structured context into AI-ready text.
   */
  const formatted =
    formatStoryContext(
      context,
    )

  /*
   * Story summary is project-level context and is
   * displayed alongside the actual formatted scene
   * context below.
   */
  const storySummary =
    project.storySummary?.trim() ?? ""

  /*
   * The complete visible context preview.
   *
   * The scene/world context itself comes directly
   * from formatStoryContext().
   *
   * Nothing is reconstructed or guessed here.
   */
  const displayedAIContext = [
    storySummary
      ? `## Story Summary\n${storySummary}`
      : null,

    formatted.text,
  ]
    .filter(Boolean)
    .join("\n\n")

  /*
   * Estimate the displayed context using the same
   * rough 4-characters-per-token approach used by
   * buildSceneContext.ts.
   *
   * The formatted scene context already provides its
   * own estimate, so only the additional story summary
   * needs to be added here.
   */
  const storySummaryTokens =
    storySummary
      ? Math.ceil(
          storySummary.length / 4,
        )
      : 0

  const displayedContextTokens =
    formatted.estimatedTokens +
    storySummaryTokens

  /*
   * Radix/shadcn Slider versions can expose
   * either a number or a readonly number[].
   */
  const handleResponseLengthChange = (
    value:
      | number
      | readonly number[],
  ) => {
    const nextValue =
      typeof value === "number"
        ? value
        : value[0]

    if (
      nextValue === undefined
    ) {
      return
    }

    setContinueWritingLength(
      nextValue,
    )

    saveContinueWritingLength(
      nextValue,
    )
  }

  const handleSceneContextChange = (
    value: string,
  ) => {
    setSceneAIContext(
      value,
    )

    saveSceneAIContext(
      activeScene.id,
      value,
    )
  }

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

          {/* Continue AI */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Continue AI
              </h2>

              <p className="text-sm text-muted-foreground">
                Control how much text the AI can generate when continuing this scene.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <div className="mb-5">
                <div className="flex items-center justify-between gap-4">
                  <Label
                    htmlFor="continue-writing-length"
                    className="text-sm font-medium"
                  >
                    Response length
                  </Label>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {continueWritingLength.toLocaleString()} tokens
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Maximum number of tokens the AI can generate.
                </p>
              </div>

              <div className="px-1">
                <Slider
                  id="continue-writing-length"
                  min={128}
                  max={4096}
                  step={128}
                  value={continueWritingLength}
                  onValueChange={
                    handleResponseLengthChange
                  }
                  className="w-full cursor-pointer"
                  aria-label="Continue AI response length"
                />
              </div>

              <div className="relative mt-3 h-4 text-xs text-muted-foreground">
                <span className="absolute left-0">
                  128
                </span>

                <span
                  className="absolute -translate-x-1/2"
                  style={{
                    left: "22.1%",
                  }}
                >
                  1,024
                </span>

                <span
                  className="absolute -translate-x-1/2"
                  style={{
                    left: "48.4%",
                  }}
                >
                  2,048
                </span>

                <span className="absolute right-0">
                  4,096
                </span>
              </div>
            </div>
          </section>

          {/* Scene-specific context */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Scene-Specific Instructions
              </h2>

              <p className="text-sm text-muted-foreground">
                Additional instructions that only apply to this scene.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <Label
                htmlFor="scene-ai-context"
                className="text-sm font-medium"
              >
                Additional context
              </Label>

              <Textarea
                id="scene-ai-context"
                value={sceneAIContext}
                onChange={(event) =>
                  handleSceneContextChange(
                    event.target.value,
                  )
                }
                placeholder="For example: Keep the conversation tense. The character is hiding what really happened last night..."
                className="mt-3 min-h-[140px] resize-y"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                This context is saved automatically for this scene.
              </p>
            </div>
          </section>

          {/* Context Summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Context Summary
              </h2>

              <p className="text-sm text-muted-foreground">
                What the automatic scene context contains.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ContextStat
                icon={Users}
                label="Characters"
                value={
                  formatted.characterCount
                }
              />

              <ContextStat
                icon={MapPin}
                label="Locations"
                value={
                  formatted.locationCount
                }
              />

              <ContextStat
                icon={Link2}
                label="Relationships"
                value={
                  formatted.relationshipCount
                }
              />

              <ContextStat
                icon={MessageSquare}
                label="Estimated Tokens"
                value={
                  displayedContextTokens
                }
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

          {/* Current Scene */}
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

          {/* Formatted AI Context */}
          <section className="pb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Formatted AI Context
                </h2>

                <p className="text-sm text-muted-foreground">
                  The actual context produced by the AI context formatter.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-4 w-4" />

                {displayedContextTokens.toLocaleString()} tokens
              </div>
            </div>

            <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-5 font-mono text-xs leading-relaxed">
              {displayedAIContext}
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
