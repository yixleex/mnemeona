import {
  Calculator,
  Eye,
  MapPin,
  MessageSquare,
  Package,
  ScrollText,
  Sparkles,
  Users,
  CalendarDays,
  Flag,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import { useProject } from "@/context/ProjectContext"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

import {
  buildSceneContext,
  formatStoryContext,
} from "@/components/ai/aicontext/buildSceneContext"

import {
  loadContinueWritingLength,
  saveContinueWritingLength,
} from "@/components/ai/aiservice/aiService"

import { useAITokenCount } from "@/components/ai/aiservice/useAITokenCount"

interface AIContextPanelProps {
  onClose?: () => void
  onTokenCalculationChange?: (
    isCalculating: boolean,
  ) => void
}

// --------------------------------------------------
// Local Gemma 3 Estimate
// --------------------------------------------------

function extractSceneText(
  scene: {
    content?: unknown
  } | null,
): string {
  if (!scene?.content) {
    return ""
  }

  const extractNode = (
    node: unknown,
  ): string => {
    if (
      !node ||
      typeof node !== "object"
    ) {
      return ""
    }

    const current =
      node as {
        text?: string
        content?: unknown[]
      }

    const parts: string[] = []

    if (
      typeof current.text ===
      "string"
    ) {
      parts.push(
        current.text,
      )
    }

    if (
      Array.isArray(
        current.content,
      )
    ) {
      for (
        const child of current.content
      ) {
        const childText =
          extractNode(child)

        if (childText) {
          parts.push(
            childText,
          )
        }
      }
    }

    return parts.join(" ")
  }

  return extractNode(
    scene.content,
  ).trim()
}

function estimateTokens(
  text: string,
): number {
  const trimmed =
    text.trim()

  if (!trimmed) {
    return 0
  }

  return (
    Math.ceil(
      trimmed.length /
        3.5,
    ) + 10
  )
}

interface EstimatedPromptParts {
  formattedContext: string
  sceneText: string
}

function buildEstimatedPromptText({
  formattedContext,
  sceneText,
}: EstimatedPromptParts): string {
  return [
    formattedContext,
    sceneText
      ? `CURRENT SCENE TEXT:\n${sceneText}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

// --------------------------------------------------
// Panel
// --------------------------------------------------

export function AIContextPanel({
  onClose,
  onTokenCalculationChange,
}: AIContextPanelProps) {
  const {
    project,
    activeScene,
    updateProject,
  } = useProject()

  const [
    continueWritingLength,
    setContinueWritingLength,
  ] = useState(
    loadContinueWritingLength(),
  )

  const [
    storySummaryDraft,
    setStorySummaryDraft,
  ] = useState(
    project.storySummary ?? "",
  )

  const sceneAIContext =
    activeScene?.aiAdditionalContext ?? ""

  useEffect(() => {
    setContinueWritingLength(
      loadContinueWritingLength(),
    )
  }, [])

  useEffect(() => {
    setStorySummaryDraft(
      project.storySummary ?? "",
    )
  }, [
    project.storySummary,
    activeScene?.id,
  ])

  const messages:
    | undefined = undefined

  const {
    tokenCount,
    isCalculating,
    isApproximate,
    calculateTokenCount,
  } = useAITokenCount({
    project,
    activeScene,
    responseTokens:
      continueWritingLength,
    messages,
  })

  useEffect(() => {
    onTokenCalculationChange?.(
      isCalculating,
    )
  }, [
    isCalculating,
    onTokenCalculationChange,
  ])

  // --------------------------------------------------
  // Empty State
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Build Scene Context
  // --------------------------------------------------

  const context =
    buildSceneContext(
      activeScene,
      project.characters,
      project.locations,
      project.events,
      project.factions ?? [],
      project.artifacts ?? [],
      project.lore ?? [],
    )

  const formatted =
    formatStoryContext(
      context,
    )

  // --------------------------------------------------
  // Story Summary
  // --------------------------------------------------

  const storySummary =
    storySummaryDraft.trim()

  const contextSections: string[] = []

  if (
    storySummary
  ) {
    contextSections.push(
      [
        "## Story So Far",
        "",
        storySummary,
      ].join("\n"),
    )
  } else {
    contextSections.push(
      [
        "## Story So Far",
        "",
        "No story summary has been generated yet.",
      ].join("\n"),
    )
  }

  contextSections.push(
    [
      "## Current Story Context",
      "",
      formatted.text,
    ].join("\n"),
  )

  const formattedText =
    contextSections.join(
      "\n\n",
    )

  // --------------------------------------------------
  // Scene Text
  // --------------------------------------------------

  const sceneText =
    extractSceneText(
      activeScene,
    )

  const estimatedPromptText =
    buildEstimatedPromptText({
      formattedContext:
        formattedText,
      sceneText,
    })

  const formattedEstimatedTokens =
    estimateTokens(
      estimatedPromptText,
    )

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------

  const handleResponseLengthChange =
    (
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

      window.dispatchEvent(
        new Event(
          "mnemeona:continue-writing-length-changed",
        ),
      )
    }

  const handleStorySummaryChange =
    (
      value: string,
    ) => {
      setStorySummaryDraft(
        value,
      )

      updateProject(
        (currentProject) => ({
          ...currentProject,
          storySummary:
            value,
          updatedAt:
            new Date().toISOString(),
        }),
      )
    }

  const handleSceneContextChange =
    (
      value: string,
    ) => {
      updateProject(
        (currentProject) => ({
          ...currentProject,

          manuscript: {
            ...currentProject.manuscript,

            acts:
              currentProject.manuscript.acts.map(
                (act) => ({
                  ...act,

                  chapters:
                    act.chapters.map(
                      (chapter) => ({
                        ...chapter,

                        scenes:
                          chapter.scenes.map(
                            (scene) =>
                              scene.id ===
                              activeScene.id
                                ? {
                                    ...scene,
                                    aiAdditionalContext:
                                      value,
                                  }
                                : scene,
                          ),
                      }),
                    ),
                }),
              ),
          },

          updatedAt:
            new Date().toISOString(),
        }),
      )
    }

  const handleCalculateTokens =
    () => {
      calculateTokenCount()
    }

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ================================================== */}
      {/* Header */}
      {/* ================================================== */}

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
                Everything currently available to the AI for this scene.
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

      {/* ================================================== */}
      {/* Content */}
      {/* ================================================== */}

      <div className="flex-1 overflow-y-auto">

        <div className="mx-auto w-full max-w-6xl space-y-6 p-6">

          {/* ================================================== */}
          {/* Continue AI Settings */}
          {/* ================================================== */}

          <section>
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
                    {continueWritingLength.toLocaleString()}{" "}
                    tokens
                  </span>

                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Controls the maximum number of tokens the AI can
                  generate when you use Continue AI.
                </p>

              </div>

              <div className="px-1">

                <Slider
                  id="continue-writing-length"
                  min={128}
                  max={4096}
                  step={128}
                  value={[
                    continueWritingLength,
                  ]}
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
                    left: "22.8%",
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

          {/* ================================================== */}
          {/* Story So Far */}
          {/* ================================================== */}

          <section>

            <div className="mb-4">

              <h2 className="text-sm font-semibold">
                Story So Far
              </h2>

              <p className="text-sm text-muted-foreground">
                The persistent summary of what has actually happened
                in the story. You can edit it to correct or clarify
                anything the AI got wrong or missed.
              </p>

            </div>

            <div className="rounded-xl border bg-card p-5">

              <Textarea
                id="story-summary"
                value={storySummaryDraft}
                onChange={(event) =>
                  handleStorySummaryChange(
                    event.target.value,
                  )
                }
                placeholder="The story summary will appear here once it has been generated. You can also write or correct it yourself..."
                className="min-h-[180px] resize-y leading-relaxed"
                aria-label="Story So Far"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Changes are saved automatically and will be used by the
                AI as the persistent story summary.
              </p>

            </div>

          </section>

          {/* ================================================== */}
          {/* Scene-specific context */}
          {/* ================================================== */}

          <section>

            <div className="mb-4">

              <h2 className="text-sm font-semibold">
                Scene-Specific Instructions
              </h2>

              <p className="text-sm text-muted-foreground">
                Additional information that should apply only to this
                scene.
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
                placeholder="For example: Elara is secretly meeting Marcus at Blackwood Manor tonight. She knows something Marcus does not..."
                className="mt-3 min-h-[140px] resize-y"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                This context is saved directly to the scene. It is
                included in the AI context and is also used for automatic
                character, location, world-event, faction, artifact,
                and world lore detection.
              </p>

            </div>

          </section>

          {/* ================================================== */}
          {/* Prompt Context / Token Count */}
          {/* ================================================== */}

          <section>

            <div className="mb-4">

              <h2 className="text-sm font-semibold">
                Prompt Context
              </h2>

              <p className="text-sm text-muted-foreground">
                Token usage for the context and selected response
                budget.
              </p>

            </div>

            <div className="rounded-xl border bg-card p-5">

              {tokenCount ? (

                <>

                  <div className="flex items-start justify-between gap-4">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <p className="text-lg font-semibold">

                          {isApproximate
                            ? "≈ "
                            : ""}

                          {tokenCount.totalTokens.toLocaleString()}

                          {tokenCount.contextLength
                            ? ` / ${tokenCount.contextLength.toLocaleString()}`
                            : ""}{" "}
                          tokens

                        </p>

                        {isApproximate ? (

                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600">
                            Approximate
                          </span>

                        ) : (

                          <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-medium text-green-600">
                            Model counted
                          </span>

                        )}

                      </div>

                      {isApproximate && (

                        <p className="mt-2 text-xs text-amber-600">
                          {isCalculating
                            ? "Waiting for Ollama to calculate the actual token count…"
                            : "Ollama could not provide the actual token count, so the approximate count is being shown."}
                        </p>

                      )}

                      {!isApproximate && (

                        <p className="mt-1 text-xs text-muted-foreground">
                          Token count reported by the selected Ollama
                          model.
                        </p>

                      )}

                    </div>

                    {tokenCount.percentage !==
                    null ? (

                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">

                        {isApproximate
                          ? "≈ "
                          : ""}

                        {tokenCount.percentage.toFixed(
                          1,
                        )}

                        %

                      </span>

                    ) : (

                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        Context size unavailable
                      </span>

                    )}

                  </div>

                  {isCalculating && (

                    <div className="mt-4">

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">

                        <div className="h-full w-1/3 animate-[tokenGauge_1.4s_ease-in-out_infinite] rounded-full bg-primary/70" />

                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Ollama is evaluating the prompt with the
                        selected model…
                      </p>

                    </div>

                  )}

                  {!isCalculating && (

                    <div className="mt-4">

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">

                        {tokenCount.percentage !==
                        null ? (

                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  tokenCount.percentage,
                                ),
                              )}%`,
                            }}
                          />

                        ) : (

                          <div className="h-full w-full bg-primary/20" />

                        )}

                      </div>

                    </div>

                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">

                    <div className="rounded-lg bg-muted/40 p-3">

                      <p className="text-xs text-muted-foreground">
                        Prompt
                      </p>

                      <p className="mt-1 font-medium">
                        {isApproximate
                          ? "≈ "
                          : ""}
                        {tokenCount.promptTokens.toLocaleString()}
                      </p>

                      {isApproximate && (
                        <p className="mt-1 text-[11px] text-amber-600">
                          Approximate
                        </p>
                      )}

                    </div>

                    <div className="rounded-lg bg-muted/40 p-3">

                      <p className="text-xs text-muted-foreground">
                        Response budget
                      </p>

                      <p className="mt-1 font-medium">
                        {tokenCount.responseTokens.toLocaleString()}
                      </p>

                    </div>

                  </div>

                  {isApproximate &&
                    tokenCount.tokenizerError && (

                    <p className="mt-3 break-words text-xs text-muted-foreground">
                      Ollama status:{" "}
                      {tokenCount.tokenizerError}
                    </p>

                  )}

                  {tokenCount.contextLength &&
                    tokenCount.totalTokens >
                      tokenCount.contextLength && (

                    <p className="mt-3 text-xs font-medium text-destructive">
                      The prompt and selected response length exceed
                      this model's context window.
                    </p>

                  )}

                  {tokenCount.contextLength &&
                    tokenCount.totalTokens <=
                      tokenCount.contextLength &&
                    tokenCount.percentage !== null &&
                    tokenCount.percentage >= 80 && (

                    <p className="mt-3 text-xs font-medium text-amber-600">
                      This request is using most of the model's context
                      window. Consider reducing the response length or
                      scene/context size.
                    </p>

                  )}

                </>

              ) : (

                <div>

                  <div className="flex items-center justify-between gap-4">

                    <div>
                      <p className="text-sm font-medium">
                        Model token count has not been requested
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        handleCalculateTokens
                      }
                      disabled={
                        isCalculating
                      }
                      className="shrink-0"
                    >
                      <Calculator className="mr-2 h-4 w-4" />

                      {isCalculating
                        ? "Calculating…"
                        : "Calculate tokens"}
                    </Button>

                  </div>

                  <div className="mt-4 rounded-lg bg-muted/30 p-4">

                    <div className="flex items-center justify-between gap-4">

                      <span className="text-sm text-muted-foreground">
                        Estimated Tokens
                      </span>

                      <span className="font-medium">
                        ≈{" "}
                        {formattedEstimatedTokens.toLocaleString()}{" "}
                        tokens
                      </span>

                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Includes Story So Far, current story context,
                      characters, locations, world events, factions,
                      artifacts, world lore, and the actual scene text.
                      Persistent notes are still included in the AI prompt
                      but are managed separately in the Notes workspace.
                    </p>

                  </div>

                  {isCalculating && (

                    <div className="mt-4">

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">

                        <div className="h-full w-1/3 animate-[tokenGauge_1.4s_ease-in-out_infinite] rounded-full bg-primary/70" />

                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Waiting for Ollama to calculate the actual
                        token count…
                      </p>

                    </div>

                  )}

                </div>

              )}

              {tokenCount && (

                <div className="mt-5 border-t pt-4">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      handleCalculateTokens
                    }
                    disabled={
                      isCalculating
                    }
                  >
                    <Calculator className="mr-2 h-4 w-4" />

                    {isCalculating
                      ? "Calculating…"
                      : "Recalculate tokens"}

                  </Button>

                </div>

              )}

            </div>

          </section>

          {/* ================================================== */}
          {/* Context & Automatic Detection */}
          {/* ================================================== */}

          <section>

            <div className="mb-4">

              <h2 className="text-sm font-semibold">
                Context & Automatic Detection
              </h2>

              <p className="text-sm text-muted-foreground">
                Everything the AI has identified and can currently use
                from the project and this scene.
              </p>

            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">

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
                icon={CalendarDays}
                label="World Events"
                value={
                  formatted.eventCount
                }
              />

              <ContextStat
                icon={Flag}
                label="Factions"
                value={
                  formatted.factionCount
                }
              />

              <ContextStat
                icon={Package}
                label="Artifacts"
                value={
                  formatted.artifactCount
                }
              />

              {/* NEW: World Lore */}
              <ContextStat
                icon={ScrollText}
                label="World Lore"
                value={
                  formatted.loreCount
                }
              />

            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">

              <ContextStat
                icon={MessageSquare}
                label="Estimated Tokens"
                value={
                  formattedEstimatedTokens
                }
              />

            </div>

          </section>

          {/* ================================================== */}
          {/* Current Scene */}
          {/* ================================================== */}

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

              {activeScene.aiAdditionalContext?.trim() && (

                <div className="mt-4 border-t pt-4">

                  <span className="text-sm text-muted-foreground">
                    Additional Context
                  </span>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {activeScene.aiAdditionalContext.trim()}
                  </p>

                </div>

              )}

            </div>

          </section>

          {/* ================================================== */}
          {/* Formatted AI Context */}
          {/* ================================================== */}

          <section className="pb-8">

            <div className="mb-4 flex items-center justify-between gap-4">

              <div>

                <h2 className="text-sm font-semibold">
                  Formatted AI Context
                </h2>

                <p className="text-sm text-muted-foreground">
                  Story So Far, current story context, detected world
                  information, artifacts, world lore, and scene prose
                  available to the AI. Persistent notes remain managed
                  separately.
                </p>

              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">

                <Eye className="h-4 w-4" />

                ≈{" "}
                {formattedEstimatedTokens.toLocaleString()}{" "}
                tokens

              </div>

            </div>

            <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-5 font-mono text-xs leading-relaxed">
              {formattedText}

              {sceneText && (
                <>
                  {"\n\n"}
                  {"CURRENT SCENE TEXT:\n"}
                  {sceneText}
                </>
              )}
            </pre>

          </section>

        </div>

      </div>

      {/* ================================================== */}
      {/* Loading Animation */}
      {/* ================================================== */}

      <style>
        {`
          @keyframes tokenGauge {
            0% {
              transform: translateX(-120%);
            }

            100% {
              transform: translateX(420%);
            }
          }
        `}
      </style>

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
