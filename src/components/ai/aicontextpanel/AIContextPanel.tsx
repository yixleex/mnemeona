import {
  Eye,
  Link2,
  MapPin,
  MessageSquare,
  Sparkles,
  Users,
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
} from "@/components/ai/context/buildSceneContext"

import {
  loadContinueWritingLength,
  loadSceneAIContext,
  saveContinueWritingLength,
  saveSceneAIContext,
} from "@/components/ai/aiservice/aiService"

import {
  createApproximateAIRequestTokens,
  estimateAIRequestTokens,
  formatTokenCount,
  type AITokenCount,
} from "@/components/ai/aiservice/aiTokenCounter"

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

  const [
    tokenCount,
    setTokenCount,
  ] = useState<AITokenCount | null>(
    null,
  )

  const [
    tokenCountLoading,
    setTokenCountLoading,
  ] = useState(false)

  // --------------------------------------------------
  // Scene Context
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Response Length
  // --------------------------------------------------

  useEffect(() => {
    setContinueWritingLength(
      loadContinueWritingLength(),
    )
  }, [])

  // --------------------------------------------------
  // Token Gauge
  // --------------------------------------------------

  useEffect(() => {
    if (!activeScene) {
      setTokenCount(null)
      return
    }

    const controller =
      new AbortController()

    let cancelled = false

    /*
     * The Continue AI request currently uses the scene text
     * as part of the model input. We count it here but do not
     * display it in Formatted AI Context.
     */
    const messages: {
      role:
        | "system"
        | "user"
        | "assistant"

      content: string
    }[] = []

    /*
     * IMPORTANT:
     *
     * Put an approximate result into the UI immediately.
     * The user should never see an empty gauge just because
     * Ollama is taking time to answer.
     */
    const approximate =
      createApproximateAIRequestTokens(
        project,
        activeScene,
        continueWritingLength,
        messages,
      )

    setTokenCount(
      approximate,
    )

    setTokenCountLoading(
      true,
    )

    const updateTokenCount =
      async () => {
        try {
          const result =
            await estimateAIRequestTokens(
              project,
              activeScene,
              continueWritingLength,
              messages,
              controller.signal,
            )

          if (
            cancelled
          ) {
            return
          }

          setTokenCount(
            result,
          )
        } catch (error) {
          if (
            cancelled
          ) {
            return
          }

          /*
           * Keep the approximate value visible if
           * the actual count fails.
           */
          setTokenCount(
            (current) => {
              if (!current) {
                return approximate
              }

              return {
                ...current,

                source:
                  "estimate",

                tokenizerAvailable:
                  false,

                tokenizerError:
                  error instanceof
                  Error
                    ? error.message
                    : "Unable to obtain the actual model token count.",
              }
            },
          )
        } finally {
          if (
            !cancelled
          ) {
            setTokenCountLoading(
              false,
            )
          }
        }
      }

    void updateTokenCount()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    project,
    activeScene,
    continueWritingLength,
    sceneAIContext,
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
  // Formatted Context
  // --------------------------------------------------

  const context =
    buildSceneContext(
      activeScene,
      project.characters,
      project.locations,
    )

  const formatted =
    formatStoryContext(
      context,
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
    }

  const handleSceneContextChange =
    (
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

  // --------------------------------------------------
  // Gauge
  // --------------------------------------------------

  const percentage =
    tokenCount?.percentage

  const isApproximate =
    tokenCount?.source ===
    "estimate"

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

          {/* Scene-specific context */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Scene-Specific Instructions
              </h2>

              <p className="text-sm text-muted-foreground">
                Additional instructions that should only apply to this
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
                placeholder="For example: Keep the conversation tense. The character is hiding what really happened last night..."
                className="mt-3 min-h-[140px] resize-y"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                This context is saved automatically for this scene
                and will be included in AI requests.
              </p>
            </div>
          </section>

          {/* Prompt Context Gauge */}
          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Prompt Context
              </h2>

              <p className="text-sm text-muted-foreground">
                Includes the current scene, AI context, and your
                selected response budget.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              {tokenCount ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">
                          {isApproximate
                            ? "≈ "
                            : ""}
                          {formatTokenCount(
                            tokenCount.totalTokens,
                          )}

                          {tokenCount.contextLength
                            ? ` / ${formatTokenCount(
                                tokenCount.contextLength,
                              )}`
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

                      {isApproximate ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium text-amber-600">
                            {tokenCountLoading
                              ? "Waiting for Ollama to provide the actual token count…"
                              : "Ollama could not provide the actual token count."}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            The number shown is an approximate
                            estimate and may differ from the model's
                            actual tokenizer count.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Token count reported by the selected Ollama
                          model.
                        </p>
                      )}
                    </div>

                    {percentage !== null ? (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {isApproximate
                          ? "≈ "
                          : ""}
                        {percentage.toFixed(
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

                  {/* Gauge */}
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      {percentage !== null ? (
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isApproximate
                              ? "bg-primary/40"
                              : "bg-primary"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                percentage,
                              ),
                            )}%`,
                          }}
                        />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-primary/20" />
                      )}
                    </div>
                  </div>

                  {/* Token breakdown */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Prompt
                      </p>

                      <p className="mt-1 font-medium">
                        {isApproximate
                          ? "≈ "
                          : ""}
                        {formatTokenCount(
                          tokenCount.promptTokens,
                        )}
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
                        {formatTokenCount(
                          tokenCount.responseTokens,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Ollama status */}
                  {isApproximate &&
                    tokenCount.tokenizerError && (
                      <p className="mt-3 break-words text-xs text-muted-foreground">
                        Ollama status:{" "}
                        {tokenCount.tokenizerError}
                      </p>
                    )}

                  {/* Context warnings */}
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
                        This request is using most of the model's
                        context window. Consider reducing the response
                        length or scene/context size.
                      </p>
                    )}
                </>
              ) : (
                <div className="py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      Calculating prompt size…
                    </p>

                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                      Approximate
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    We are calculating an approximate token count while
                    waiting for Ollama to provide the actual model
                    token count.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Context Summary */}
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
                label="Formatted Context Tokens"
                value={
                  formatted.estimatedTokens
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

          {/* Formatted Context */}
          <section className="pb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Formatted AI Context
                </h2>

                <p className="text-sm text-muted-foreground">
                  This is the exact text currently produced by the
                  context formatter. The scene prose is counted for the
                  prompt gauge but is not duplicated here.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-4 w-4" />

                {formatted.estimatedTokens.toLocaleString()}{" "}
                tokens
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
