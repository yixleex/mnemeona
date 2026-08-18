import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ImagePlus,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { Character } from "@/types/character"
import type { MnemeonaImage } from "@/types/image"

import { saveImage } from "@/lib/imageDatabase"

import {
  generateImage,
  getImageProviders,
  loadImageAiConfig,
  saveImageAiConfig,
  type ImageAiConfig,
  type ImageAiProvider,
} from "@/lib/imageAiProvider"

interface ImageGenerationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  character: Character
  projectId: string
  onImageSaved?: (imageId: string) => void
}

type GenerationStatus =
  | "idle"
  | "generating"
  | "saving"
  | "success"
  | "error"

/**
 * Recommended inference steps for each model.
 *
 * These are applied automatically when the user selects
 * a provider. The user can still manually change Steps afterward.
 */
const RECOMMENDED_STEPS: Record<string, number> = {
  lcm: 8,
  sdxl_dreamshaper: 25,
  sdxl_vega: 30,
}

const DEFAULT_STEPS = 25

function getRecommendedSteps(
  providerId: string,
): number {
  return (
    RECOMMENDED_STEPS[providerId] ??
    DEFAULT_STEPS
  )
}

function buildCharacterPrompt(
  character: Character,
): string {
  const sections: string[] = []

  sections.push(
    `Portrait of ${character.name || "a character"}.`,
  )

  if (character.age.trim()) {
    sections.push(`Age: ${character.age.trim()}.`)
  }

  if (character.appearance.trim()) {
    sections.push(
      `Appearance: ${character.appearance.trim()}`,
    )
  }

  if (character.personality.trim()) {
    sections.push(
      `Facial expression and demeanor reflecting this personality: ${character.personality.trim()}`,
    )
  }

  sections.push(
    "Chest-up portrait, three-quarter view, looking toward the camera, natural relaxed pose.",
  )

  sections.push(
    "Detailed face, expressive eyes, natural anatomy, realistic proportions.",
  )

  sections.push(
    "Detailed clothing appropriate to the character's appearance and setting.",
  )

  sections.push(
    "Cinematic lighting, soft shadows, subtle rim light, atmospheric depth.",
  )

  sections.push(
    "High-quality fantasy character concept art, polished digital painting, detailed and professional.",
  )

  sections.push(
    "Clean background, centered composition, sharp facial details.",
  )

  sections.push(
    "No text, no captions, no logo, no watermark, no signature.",
  )

  return sections.join("\n\n")
}

function createImageId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

export function ImageGenerationDialog({
  open,
  onOpenChange,
  character,
  projectId,
  onImageSaved,
}: ImageGenerationDialogProps) {
  const [config, setConfig] =
    useState<ImageAiConfig>(() =>
      loadImageAiConfig(),
    )

  const [providers, setProviders] =
    useState<ImageAiProvider[]>([])

  const [prompt, setPrompt] = useState("")
  const [width, setWidth] = useState(768)
  const [height, setHeight] = useState(768)

  const [steps, setSteps] = useState(() =>
    getRecommendedSteps(
      loadImageAiConfig().provider,
    ),
  )

  const [status, setStatus] =
    useState<GenerationStatus>("idle")

  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [testMessage, setTestMessage] =
    useState("")

  const [generatedBlob, setGeneratedBlob] =
    useState<Blob | null>(null)

  const [generatedMimeType, setGeneratedMimeType] =
    useState("image/png")

  const [generatedSeed, setGeneratedSeed] =
    useState<number | undefined>()

  const [generatedProvider, setGeneratedProvider] =
    useState<string | undefined>()

  const [savedImageId, setSavedImageId] =
    useState<string | null>(null)

  const [testing, setTesting] = useState(false)
  const [showSettings, setShowSettings] =
    useState(false)

  const [controller, setController] =
    useState<AbortController | null>(null)

  const previewUrl = useMemo(() => {
    if (!generatedBlob) {
      return null
    }

    return URL.createObjectURL(generatedBlob)
  }, [generatedBlob])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!open) {
      return
    }

    const loaded = loadImageAiConfig()

    setConfig(loaded)
    setPrompt(buildCharacterPrompt(character))
    setWidth(768)
    setHeight(768)
    setSteps(
      getRecommendedSteps(
        loaded.provider,
      ),
    )
    setStatus("idle")
    setProgress(0)
    setError("")
    setTestMessage("")
    setGeneratedBlob(null)
    setGeneratedSeed(undefined)
    setGeneratedProvider(undefined)
    setSavedImageId(null)
    setShowSettings(false)

    void refreshProviders()
  }, [open, character.id])

  /**
   * A provider returned by mnemeona-image is already installed/discovered.
   *
   * `installed` is therefore optional:
   *
   *   undefined → provider was discovered, so available
   *   true      → explicitly available
   *   false     → explicitly unavailable
   */
  function isProviderAvailable(
    provider: ImageAiProvider,
  ): boolean {
    return (
      provider.enabled &&
      provider.installed !== false
    )
  }

  async function refreshProviders() {
    try {
      const result =
        await getImageProviders()

      setProviders(result.providers)

      setConfig((current) => {
        const selectedExists =
          result.providers.some(
            (provider) =>
              provider.id === current.provider &&
              isProviderAvailable(provider),
          )

        const next = selectedExists
          ? current
          : {
              ...current,
              provider:
                result.active_provider &&
                result.providers.some(
                  (provider) =>
                    provider.id ===
                      result.active_provider &&
                    isProviderAvailable(provider),
                )
                  ? result.active_provider
                  : result.providers.find(
                      isProviderAvailable,
                    )?.id ||
                    current.provider,
            }

        saveImageAiConfig(next)

        return next
      })
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not load installed image AIs.",
      )
    }
  }

  function updateConfig(
    updates: Partial<ImageAiConfig>,
  ) {
    const next = {
      ...config,
      ...updates,
    }

    setConfig(next)
    saveImageAiConfig(next)
  }

  function updateProviderSetting(
    key: string,
    value: unknown,
  ) {
    updateConfig({
      settings: {
        ...config.settings,
        [key]: value,
      },
    })
  }

  function selectProvider(
    providerId: string,
  ) {
    const recommendedSteps =
      getRecommendedSteps(providerId)

    updateConfig({
      provider: providerId,
    })

    setSteps(recommendedSteps)

    // Selecting a new model means the previous generated
    // image no longer represents the current settings.
    setGeneratedBlob(null)
    setGeneratedSeed(undefined)
    setGeneratedProvider(undefined)
    setSavedImageId(null)
    setStatus("idle")
    setError("")
    setProgress(0)
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestMessage("")
    setError("")

    try {
      const result =
        await getImageProviders()

      setProviders(result.providers)

      setTestMessage(
        `${result.providers.length} image AI provider${
          result.providers.length === 1 ? "" : "s"
        } detected. Active: ${
          result.active_provider || "none"
        }.`,
      )
    } catch (testError) {
      setTestMessage(
        testError instanceof Error
          ? testError.message
          : "Image service connection failed.",
      )
    } finally {
      setTesting(false)
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError(
        "Enter an image prompt before generating.",
      )

      return
    }

    const selectedProvider =
      providers.find(
        (provider) =>
          provider.id === config.provider &&
          isProviderAvailable(provider),
      )

    if (!selectedProvider) {
      setError(
        "The selected image AI provider is not available.",
      )

      return
    }

    saveImageAiConfig(config)

    const abortController =
      new AbortController()

    setController(abortController)
    setStatus("generating")
    setProgress(0)
    setError("")
    setGeneratedBlob(null)
    setGeneratedSeed(undefined)
    setGeneratedProvider(undefined)
    setSavedImageId(null)

    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        width,
        height,
        steps,
        provider: config.provider,
        settings: config.settings,
        signal: abortController.signal,
        onProgress: (value) =>
          setProgress(value),
      })

      setGeneratedBlob(result.blob)
      setGeneratedMimeType(result.mimeType)
      setGeneratedSeed(result.seed)
      setGeneratedProvider(result.provider)
      setProgress(100)
      setStatus("success")
    } catch (generationError) {
      if (
        generationError instanceof Error &&
        generationError.name === "AbortError"
      ) {
        setStatus("idle")
        setProgress(0)

        return
      }

      setStatus("error")
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Image generation failed.",
      )
    } finally {
      setController(null)
    }
  }

  function handleCancel() {
    controller?.abort()
  }

  async function handleSaveImage() {
    if (!generatedBlob) {
      return
    }

    setStatus("saving")
    setError("")

    try {
      const now =
        new Date().toISOString()

      const imageId = createImageId()

      const image: MnemeonaImage = {
        id: imageId,
        projectId,
        name:
          `${character.name || "Character"} portrait`,
        type: "character",
        entityId: character.id,
        mimeType: generatedMimeType,
        blob: generatedBlob,
        prompt: prompt.trim(),
        width,
        height,
        createdAt: now,
        updatedAt: now,
      }

      await saveImage(image)

      setSavedImageId(imageId)
      setStatus("success")
      onImageSaved?.(imageId)
    } catch (saveError) {
      setStatus("error")
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save image.",
      )
    }
  }

  function rebuildPrompt() {
    setPrompt(buildCharacterPrompt(character))
    setGeneratedBlob(null)
    setGeneratedSeed(undefined)
    setGeneratedProvider(undefined)
    setSavedImageId(null)
    setStatus("idle")
    setError("")
    setProgress(0)
  }

  const generating =
    status === "generating"

  const saving =
    status === "saving"

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && generating) {
          controller?.abort()
        }

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="
          fixed left-1/2 top-1/2 z-[100]
          flex h-[min(900px,92vh)] w-[94vw]
          !max-w-[1180px]
          -translate-x-1/2 -translate-y-1/2
          flex-col gap-0 overflow-hidden
          rounded-2xl border bg-background p-0 shadow-2xl
        "
      >
        <DialogHeader
          className="
            shrink-0 border-b px-7 py-5 text-left
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex size-10 shrink-0 items-center
                justify-center rounded-xl bg-primary/10
              "
            >
              <ImagePlus className="size-5 text-primary" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">
                Generate Character Image
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs">
                Choose any installed local image AI.
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8 shrink-0"
              onClick={() =>
                onOpenChange(false)
              }
              disabled={generating || saving}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="
              grid h-full grid-cols-1
              lg:grid-cols-[420px_minmax(0,1fr)]
            "
          >
            <section
              className="
                flex min-h-0 flex-col border-b
                bg-muted/10 lg:border-b-0 lg:border-r
              "
            >
              <div
                className="
                  flex min-h-0 flex-1 items-center
                  justify-center overflow-hidden p-7
                "
              >
                {previewUrl ? (
                  <div
                    className="
                      flex max-h-full max-w-full
                      flex-col items-center gap-3
                    "
                  >
                    <div
                      className="
                        relative flex max-h-[65vh]
                        max-w-full items-center justify-center
                        overflow-hidden rounded-2xl border
                        bg-black/20 shadow-xl
                      "
                    >
                      <img
                        src={previewUrl}
                        alt={`Generated portrait of ${
                          character.name || "character"
                        }`}
                        className="
                          block max-h-[65vh]
                          max-w-full object-contain
                        "
                      />
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      {generatedSeed !==
                        undefined && (
                        <div
                          className="
                            rounded-full border bg-background/80
                            px-3 py-1 text-[10px]
                            text-muted-foreground
                          "
                        >
                          Seed:{" "}
                          <span className="font-mono text-foreground">
                            {generatedSeed}
                          </span>
                        </div>
                      )}

                      {generatedProvider && (
                        <div
                          className="
                            rounded-full border bg-background/80
                            px-3 py-1 text-[10px]
                            text-muted-foreground
                          "
                        >
                          AI:{" "}
                          <span className="text-foreground">
                            {generatedProvider}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="
                      flex max-w-xs flex-col items-center
                      text-center
                    "
                  >
                    <div
                      className="
                        mb-5 flex size-20 items-center
                        justify-center rounded-2xl border bg-muted
                      "
                    >
                      <Sparkles className="size-8 text-muted-foreground" />
                    </div>

                    <h3 className="text-sm font-medium">
                      No image generated yet
                    </h3>

                    <p
                      className="
                        mt-2 text-xs leading-relaxed
                        text-muted-foreground
                      "
                    >
                      Select an installed AI and generate
                      a character portrait.
                    </p>
                  </div>
                )}
              </div>

              {generating && (
                <div className="shrink-0 border-t px-7 py-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Generating...
                    </span>

                    <span className="font-mono text-xs">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </section>

            <section
              className="
                min-h-0 overflow-y-auto p-7
              "
            >
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">
                        Image AI
                      </h3>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Providers are discovered from mnemeona-image.
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={refreshProviders}
                      title="Refresh providers"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {providers.length === 0 ? (
                      <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                        No providers detected. Start the image service
                        and refresh.
                      </div>
                    ) : (
                      providers.map((provider) => {
                        const available =
                          isProviderAvailable(
                            provider,
                          )

                        const recommendedSteps =
                          getRecommendedSteps(
                            provider.id,
                          )

                        return (
                          <button
                            key={provider.id}
                            type="button"
                            disabled={!available}
                            onClick={() =>
                              selectProvider(
                                provider.id,
                              )
                            }
                            className={`
                              rounded-xl border p-3 text-left
                              transition
                              ${
                                config.provider ===
                                provider.id
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              }
                              ${
                                !available
                                  ? "cursor-not-allowed opacity-50"
                                  : ""
                              }
                            `}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {provider.name}
                                </div>

                                <div className="mt-1 text-[10px] text-muted-foreground">
                                  {provider.id}

                                  {provider.version
                                    ? ` · v${provider.version}`
                                    : ""}

                                  {` · ${recommendedSteps} steps recommended`}
                                </div>
                              </div>

                              {provider.active && (
                                <span className="rounded-full bg-muted px-2 py-1 text-[10px]">
                                  backend default
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">
                        Prompt
                      </h3>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={rebuildPrompt}
                      disabled={
                        generating || saving
                      }
                    >
                      Rebuild
                    </Button>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(event.target.value)
                    }
                    disabled={generating || saving}
                    className="
                      min-h-44 w-full resize-y rounded-xl
                      border bg-background p-3 text-sm
                      outline-none focus:ring-2 focus:ring-ring
                    "
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Settings2 className="size-4" />

                    <h3 className="text-sm font-medium">
                      Generation settings
                    </h3>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-xs">
                      Width

                      <Input
                        className="mt-1"
                        type="number"
                        min={512}
                        max={1024}
                        value={width}
                        onChange={(event) =>
                          setWidth(
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>

                    <label className="text-xs">
                      Height

                      <Input
                        className="mt-1"
                        type="number"
                        min={512}
                        max={1024}
                        value={height}
                        onChange={(event) =>
                          setHeight(
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>

                    <label className="text-xs">
                      Steps

                      <Input
                        className="mt-1"
                        type="number"
                        min={1}
                        max={50}
                        value={steps}
                        onChange={(event) =>
                          setSteps(
                            Number(
                              event.target.value,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Automatically set to the recommended value when
                    changing models. You can still adjust it manually.
                  </p>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      setShowSettings(
                        (current) => !current,
                      )
                    }
                  >
                    {showSettings
                      ? "Hide provider settings"
                      : "Show provider settings"}
                  </Button>

                  {showSettings && (
                    <div className="mt-2 rounded-xl border bg-muted/20 p-3">
                      <label className="text-xs">
                        Guidance scale

                        <Input
                          className="mt-1"
                          type="number"
                          step="0.5"
                          value={Number(
                            config.settings
                              .guidance_scale ?? 8,
                          )}
                          onChange={(event) =>
                            updateProviderSetting(
                              "guidance_scale",
                              Number(
                                event.target.value,
                              ),
                            )
                          }
                        />
                      </label>

                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                        Provider-specific settings are sent to the
                        selected backend provider. Providers that do not
                        use a setting simply ignore it.
                      </p>
                    </div>
                  )}
                </div>

                {testMessage && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    {testMessage}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={
                      testing ||
                      generating ||
                      saving
                    }
                  >
                    {testing ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}

                    Test image service
                  </Button>

                  <Button
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={
                      generating ||
                      saving ||
                      !prompt.trim() ||
                      providers.length === 0 ||
                      !providers.some(
                        (provider) =>
                          provider.id ===
                            config.provider &&
                          isProviderAvailable(
                            provider,
                          ),
                      )
                    }
                  >
                    {generating ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 size-4" />
                    )}

                    Generate
                  </Button>
                </div>

                {generatedBlob && (
                  <Button
                    className="w-full"
                    onClick={handleSaveImage}
                    disabled={
                      saving || !!savedImageId
                    }
                  >
                    {saving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-2 size-4" />
                    )}

                    {savedImageId
                      ? "Image saved"
                      : "Save image to character"}
                  </Button>
                )}
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
