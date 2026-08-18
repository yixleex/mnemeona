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
 * LCM DreamShaper v7 performs particularly well around
 * 8 steps, so that is the preferred default for LCM.
 *
 * These values are automatically applied whenever the
 * user selects a provider.
 *
 * The user can still manually change Steps afterward.
 */
const RECOMMENDED_STEPS: Record<string, number> = {
  lcm: 8,
  sdxl_dreamshaper: 25,
  sdxl_vega: 30,
  ssd_1b: 20,
  animagine_xl: 20,
}

const DEFAULT_STEPS = 25

const STYLE_OPTIONS = [
  { value: "fantasy-book", label: "Fantasy Book", prompt: "fantasy book cover illustration, rich painterly fantasy artwork, detailed digital painting" },
  { value: "dark-fantasy", label: "Dark Fantasy", prompt: "dark fantasy illustration, dramatic atmosphere, rich shadows, gothic fantasy artwork" },
  { value: "high-fantasy", label: "High Fantasy", prompt: "high fantasy illustration, epic magical atmosphere, elaborate fantasy details" },
  { value: "photorealism", label: "Photorealism", prompt: "photorealistic portrait photography, realistic skin texture, natural facial detail" },
  { value: "anime", label: "Anime", prompt: "high-quality anime illustration, clean linework, expressive anime character design" },
  { value: "manga", label: "Manga", prompt: "detailed manga character artwork, clean ink linework, expressive features" },
  { value: "western-comic", label: "Western Comic", prompt: "western comic book illustration, bold ink work, dynamic character rendering" },
  { value: "oil-painting", label: "Oil Painting", prompt: "classical oil painting, visible painterly brushwork, rich layered pigments" },
  { value: "watercolor", label: "Watercolor", prompt: "detailed watercolor illustration, delicate brushwork, translucent layered color" },
  { value: "concept-art", label: "Concept Art", prompt: "professional character concept art, polished digital painting, production-quality detail" },
  { value: "cinematic", label: "Cinematic", prompt: "cinematic character portrait, film-quality visual composition, dramatic visual storytelling" },
]

const COMPOSITION_OPTIONS = [
  { value: "chest-up", label: "Chest-up portrait", prompt: "chest-up portrait" },
  { value: "bust", label: "Bust portrait", prompt: "bust portrait" },
  { value: "waist-up", label: "Waist-up", prompt: "waist-up portrait" },
  { value: "full-body", label: "Full body", prompt: "full-body character portrait" },
  { value: "close-up", label: "Close-up", prompt: "close-up portrait" },
]

const CAMERA_OPTIONS = [
  { value: "three-quarter", label: "Three-quarter view", prompt: "three-quarter view, looking toward the camera" },
  { value: "front", label: "Front view", prompt: "front-facing view, looking toward the camera" },
  { value: "profile", label: "Profile", prompt: "side profile view" },
  { value: "low-angle", label: "Low angle", prompt: "low-angle camera perspective" },
  { value: "high-angle", label: "High angle", prompt: "high-angle camera perspective" },
]

const LIGHTING_OPTIONS = [
  { value: "cinematic", label: "Cinematic", prompt: "cinematic lighting, soft shadows, subtle rim light" },
  { value: "soft", label: "Soft studio", prompt: "soft studio lighting, gentle shadows, even illumination" },
  { value: "golden-hour", label: "Golden hour", prompt: "warm golden-hour lighting, soft sunlight" },
  { value: "moonlight", label: "Moonlight", prompt: "cool moonlight, soft blue shadows, subtle rim light" },
  { value: "dramatic", label: "Dramatic", prompt: "dramatic directional lighting, strong highlights and shadows" },
  { value: "candlelight", label: "Candlelight", prompt: "warm candlelight, flickering highlights, deep soft shadows" },
  { value: "overcast", label: "Overcast", prompt: "soft overcast daylight, natural diffuse lighting" },
]

const MOOD_OPTIONS = [
  { value: "neutral", label: "Neutral", prompt: "calm, natural expression and relaxed demeanor" },
  { value: "heroic", label: "Heroic", prompt: "heroic presence, confident expression, noble demeanor" },
  { value: "mysterious", label: "Mysterious", prompt: "mysterious atmosphere, enigmatic expression" },
  { value: "dark", label: "Dark", prompt: "dark and ominous atmosphere, serious expression" },
  { value: "joyful", label: "Joyful", prompt: "warm joyful expression, friendly and uplifting atmosphere" },
  { value: "melancholic", label: "Melancholic", prompt: "melancholic mood, thoughtful and subdued expression" },
  { value: "intimidating", label: "Intimidating", prompt: "intimidating presence, intense expression, commanding demeanor" },
  { value: "peaceful", label: "Peaceful", prompt: "peaceful atmosphere, serene expression and relaxed demeanor" },
]

const BACKGROUND_OPTIONS = [
  { value: "clean", label: "Clean background", prompt: "clean uncluttered background, centered composition" },
  { value: "fantasy", label: "Fantasy environment", prompt: "immersive fantasy environment appropriate to the character" },
  { value: "forest", label: "Forest", prompt: "detailed atmospheric fantasy forest background" },
  { value: "castle", label: "Castle", prompt: "grand fantasy castle environment in the background" },
  { value: "city", label: "City", prompt: "detailed atmospheric fantasy city background" },
  { value: "tavern", label: "Tavern", prompt: "warm detailed fantasy tavern interior" },
  { value: "studio", label: "Studio", prompt: "professional portrait studio background" },
]

function getOptionPrompt(
  options: Array<{ value: string; prompt: string }>,
  value: string,
): string {
  return options.find((option) => option.value === value)?.prompt ?? ""
}

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
  style = "fantasy-book",
  composition = "chest-up",
  camera = "three-quarter",
  lighting = "cinematic",
  mood = "neutral",
  background = "clean",
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

  sections.push(`${getOptionPrompt(STYLE_OPTIONS, style)}.`)
  sections.push(
    `${getOptionPrompt(COMPOSITION_OPTIONS, composition)}, ${getOptionPrompt(CAMERA_OPTIONS, camera)}.`,
  )
  sections.push(`${getOptionPrompt(MOOD_OPTIONS, mood)}.`)
  sections.push(`${getOptionPrompt(LIGHTING_OPTIONS, lighting)}.`)
  sections.push(`${getOptionPrompt(BACKGROUND_OPTIONS, background)}.`)

  sections.push(
    "Detailed face, expressive eyes, natural anatomy, realistic proportions.",
  )

  sections.push(
    "Detailed clothing appropriate to the character's appearance and setting.",
  )

  sections.push(
    "Sharp facial details, high detail, polished professional artwork.",
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
  const [style, setStyle] = useState("fantasy-book")
  const [composition, setComposition] = useState("chest-up")
  const [camera, setCamera] = useState("three-quarter")
  const [lighting, setLighting] = useState("cinematic")
  const [mood, setMood] = useState("neutral")
  const [background, setBackground] = useState("clean")
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

    setStyle("fantasy-book")
    setComposition("chest-up")
    setCamera("three-quarter")
    setLighting("cinematic")
    setMood("neutral")
    setBackground("clean")

    setPrompt(
      buildCharacterPrompt(
        character,
        "fantasy-book",
        "chest-up",
        "three-quarter",
        "cinematic",
        "neutral",
        "clean",
      ),
    )

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
   * The backend registry now only returns providers
   * whose model actually exists.
   *
   * Therefore a provider appearing in this list is
   * already considered installed/available.
   *
   * We still respect `enabled` and the optional
   * `installed` flag for backwards compatibility.
   */
  function isProviderAvailable(
    provider: ImageAiProvider,
  ): boolean {
    return (
      provider.enabled &&
      provider.installed !== false
    )
  }

  /**
   * Clear the current generated image because changing
   * the provider means the existing image no longer
   * represents the currently selected model/settings.
   */
  function clearGeneratedImage() {
    setGeneratedBlob(null)
    setGeneratedSeed(undefined)
    setGeneratedProvider(undefined)
    setSavedImageId(null)
    setStatus("idle")
    setError("")
    setProgress(0)
  }

  async function refreshProviders() {
    try {
      const result =
        await getImageProviders()

      /**
       * The backend registry filters missing models.
       *
       * We additionally filter here defensively so the
       * UI never displays a provider explicitly reported
       * as unavailable.
       */
      const availableProviders =
        result.providers.filter(
          isProviderAvailable,
        )

      setProviders(availableProviders)

      setConfig((current) => {
        const selectedExists =
          availableProviders.some(
            (provider) =>
              provider.id ===
              current.provider,
          )

        const backendActiveProvider =
          result.active_provider

        const backendActiveExists =
          backendActiveProvider &&
          availableProviders.some(
            (provider) =>
              provider.id ===
              backendActiveProvider,
          )

        const fallbackProvider =
          availableProviders[0]?.id

        const nextProvider =
          selectedExists
            ? current.provider
            : backendActiveExists
              ? backendActiveProvider
              : fallbackProvider

        const next = {
          ...current,
          provider:
            nextProvider ||
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

  /**
   * Selecting a model automatically applies its
   * recommended inference step count.
   *
   * For example:
   *
   *   LCM DreamShaper → 8 steps
   *   DreamShaper XL  → 25 steps
   *   Segmind Vega    → 30 steps
   */
  function selectProvider(
    providerId: string,
  ) {
    const provider =
      providers.find(
        (item) =>
          item.id === providerId,
      )

    if (
      !provider ||
      !isProviderAvailable(provider)
    ) {
      return
    }

    const recommendedSteps =
      getRecommendedSteps(providerId)

    updateConfig({
      provider: providerId,
    })

    setSteps(recommendedSteps)

    clearGeneratedImage()
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestMessage("")
    setError("")

    try {
      const result =
        await getImageProviders()

      const availableProviders =
        result.providers.filter(
          isProviderAvailable,
        )

      setProviders(availableProviders)

      setTestMessage(
        `${availableProviders.length} installed image AI provider${
          availableProviders.length === 1
            ? ""
            : "s"
        } detected. Active: ${
          result.active_provider ||
          "none"
        }.`,
      )

      /**
       * Keep the selected provider valid after
       * refreshing the backend.
       */
      setConfig((current) => {
        const stillAvailable =
          availableProviders.some(
            (provider) =>
              provider.id ===
              current.provider,
          )

        if (stillAvailable) {
          return current
        }

        const fallback =
          availableProviders[0]?.id

        if (!fallback) {
          return current
        }

        const next = {
          ...current,
          provider: fallback,
        }

        saveImageAiConfig(next)

        setSteps(
          getRecommendedSteps(
            fallback,
          ),
        )

        return next
      })
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
          provider.id ===
            config.provider &&
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
      const result =
        await generateImage({
          prompt: prompt.trim(),
          width,
          height,
          steps,
          provider: config.provider,
          settings: config.settings,
          signal:
            abortController.signal,
          onProgress: (value) =>
            setProgress(value),
        })

      setGeneratedBlob(result.blob)
      setGeneratedMimeType(
        result.mimeType,
      )
      setGeneratedSeed(result.seed)
      setGeneratedProvider(
        result.provider,
      )
      setProgress(100)
      setStatus("success")
    } catch (generationError) {
      if (
        generationError instanceof Error &&
        generationError.name ===
          "AbortError"
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
    setPrompt(
      buildCharacterPrompt(
        character,
        style,
        composition,
        camera,
        lighting,
        mood,
        background,
      ),
    )

    clearGeneratedImage()
  }

  function updatePromptStyle(
    kind:
      | "style"
      | "composition"
      | "camera"
      | "lighting"
      | "mood"
      | "background",
    value: string,
  ) {
    const nextStyle =
      kind === "style" ? value : style
    const nextComposition =
      kind === "composition"
        ? value
        : composition
    const nextCamera =
      kind === "camera" ? value : camera
    const nextLighting =
      kind === "lighting"
        ? value
        : lighting
    const nextMood =
      kind === "mood" ? value : mood
    const nextBackground =
      kind === "background"
        ? value
        : background

    if (kind === "style") setStyle(value)
    if (kind === "composition") setComposition(value)
    if (kind === "camera") setCamera(value)
    if (kind === "lighting") setLighting(value)
    if (kind === "mood") setMood(value)
    if (kind === "background") setBackground(value)

    setPrompt(
      buildCharacterPrompt(
        character,
        nextStyle,
        nextComposition,
        nextCamera,
        nextLighting,
        nextMood,
        nextBackground,
      ),
    )

    clearGeneratedImage()
  }

  const generating =
    status === "generating"

  const saving =
    status === "saving"

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (
          !nextOpen &&
          generating
        ) {
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
                Choose an installed local image AI.
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8 shrink-0"
              onClick={() =>
                onOpenChange(false)
              }
              disabled={
                generating || saving
              }
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
                          character.name ||
                          "character"
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
                        Only installed models detected by the
                        image service are shown.
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={
                        refreshProviders
                      }
                      title="Refresh providers"
                      disabled={
                        generating ||
                        saving
                      }
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {providers.length ===
                    0 ? (
                      <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                        No installed image models detected.
                        Start the image service, install a model,
                        and refresh.
                      </div>
                    ) : (
                      providers.map(
                        (provider) => {
                          const recommendedSteps =
                            getRecommendedSteps(
                              provider.id,
                            )

                          return (
                            <button
                              key={
                                provider.id
                              }
                              type="button"
                              onClick={() =>
                                selectProvider(
                                  provider.id,
                                )
                              }
                              disabled={
                                generating ||
                                saving
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
                                  generating ||
                                  saving
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }
                              `}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">
                                    {
                                      provider.name
                                    }
                                  </div>

                                  <div className="mt-1 text-[10px] text-muted-foreground">
                                    {
                                      provider.id
                                    }

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
                        },
                      )
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-medium">
                      Visual style
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose how the image should look. Changing a selection
                      automatically rebuilds the prompt.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Style",
                        value: style,
                        options: STYLE_OPTIONS,
                        kind: "style" as const,
                      },
                      {
                        label: "Composition",
                        value: composition,
                        options: COMPOSITION_OPTIONS,
                        kind: "composition" as const,
                      },
                      {
                        label: "Camera",
                        value: camera,
                        options: CAMERA_OPTIONS,
                        kind: "camera" as const,
                      },
                      {
                        label: "Lighting",
                        value: lighting,
                        options: LIGHTING_OPTIONS,
                        kind: "lighting" as const,
                      },
                      {
                        label: "Mood",
                        value: mood,
                        options: MOOD_OPTIONS,
                        kind: "mood" as const,
                      },
                      {
                        label: "Background",
                        value: background,
                        options: BACKGROUND_OPTIONS,
                        kind: "background" as const,
                      },
                    ].map((control) => (
                      <label
                        key={control.label}
                        className="text-xs"
                      >
                        {control.label}

                        <select
                          value={control.value}
                          disabled={
                            generating ||
                            saving
                          }
                          onChange={(event) =>
                            updatePromptStyle(
                              control.kind,
                              event.target.value,
                            )
                          }
                          className="
                            mt-1 h-9 w-full rounded-md border
                            bg-background px-3 text-sm outline-none
                            focus:ring-2 focus:ring-ring
                          "
                        >
                          {control.options.map(
                            (option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
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
                      onClick={
                        rebuildPrompt
                      }
                      disabled={
                        generating ||
                        saving
                      }
                    >
                      Rebuild
                    </Button>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(
                        event.target.value,
                      )
                    }
                    disabled={
                      generating ||
                      saving
                    }
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
                        disabled={
                          generating ||
                          saving
                        }
                        onChange={(
                          event,
                        ) =>
                          setWidth(
                            Number(
                              event
                                .target
                                .value,
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
                        disabled={
                          generating ||
                          saving
                        }
                        onChange={(
                          event,
                        ) =>
                          setHeight(
                            Number(
                              event
                                .target
                                .value,
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
                        disabled={
                          generating ||
                          saving
                        }
                        onChange={(
                          event,
                        ) =>
                          setSteps(
                            Number(
                              event
                                .target
                                .value,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Model recommendation is applied automatically
                    when you select a model. You can still override
                    it manually.
                  </p>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      setShowSettings(
                        (current) =>
                          !current,
                      )
                    }
                    disabled={
                      generating ||
                      saving
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
                            config
                              .settings
                              .guidance_scale ??
                              8,
                          )}
                          disabled={
                            generating ||
                            saving
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProviderSetting(
                              "guidance_scale",
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                            )
                          }
                        />
                      </label>

                      <label className="mt-3 block text-xs">
                        Negative prompt

                        <textarea
                          value={String(
                            config.settings.negative_prompt ??
                              "",
                          )}
                          disabled={
                            generating ||
                            saving
                          }
                          onChange={(event) =>
                            updateProviderSetting(
                              "negative_prompt",
                              event.target.value,
                            )
                          }
                          placeholder="Things you do not want in the image..."
                          className="
                            mt-1 min-h-20 w-full resize-y rounded-md
                            border bg-background p-2 text-xs outline-none
                            focus:ring-2 focus:ring-ring
                          "
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
                    onClick={
                      handleTestConnection
                    }
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
                    onClick={
                      handleGenerate
                    }
                    disabled={
                      generating ||
                      saving ||
                      !prompt.trim() ||
                      providers.length ===
                        0 ||
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
                    onClick={
                      handleSaveImage
                    }
                    disabled={
                      saving ||
                      !!savedImageId
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