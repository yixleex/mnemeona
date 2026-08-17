import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react"

import {
  Button,
} from "@/components/ui/button"

import {
  Input,
} from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type {
  Character,
} from "@/types/character"

import type {
  MnemeonaImage,
} from "@/types/image"

import {
  saveImage,
} from "@/lib/imageDatabase"

import {
  generateImage,
  loadZImageConfig,
  saveZImageConfig,
  testZImageConnection,
  type ZImageConfig,
} from "./zimageImageProvider"

interface ImageGenerationDialogProps {
  open: boolean

  onOpenChange: (
    open: boolean,
  ) => void

  character: Character

  projectId: string

  onImageSaved?: (
    imageId: string,
  ) => void
}

type GenerationStatus =
  | "idle"
  | "generating"
  | "saving"
  | "success"
  | "error"

function buildCharacterPrompt(
  character: Character,
): string {
  const sections: string[] =
    []

  sections.push(
    `A high-quality portrait of ${
      character.name ||
      "this character"
    }.`,
  )

  if (
    character.age.trim()
  ) {
    sections.push(
      `Age: ${character.age.trim()}.`,
    )
  }

  if (
    character.appearance.trim()
  ) {
    sections.push(
      `Physical appearance: ${character.appearance.trim()}`,
    )
  }

  if (
    character.role.trim()
  ) {
    sections.push(
      `Story role: ${character.role.trim()}.`,
    )
  }

  if (
    character.personality.trim()
  ) {
    sections.push(
      `Personality and demeanor: ${character.personality.trim()}`,
    )
  }

  if (
    character.background.trim()
  ) {
    sections.push(
      `Background context: ${character.background.trim()}`,
    )
  }

  sections.push(
    "Chest-up character portrait, clear face, strong facial identity, natural proportions.",
  )

  sections.push(
    "Professional fantasy novel character concept art, cinematic lighting, detailed clothing, rich atmosphere, polished digital illustration.",
  )

  sections.push(
    "No text, no captions, no logo, no watermark.",
  )

  return sections.join(
    "\n\n",
  )
}

function createImageId(): string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
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
  const [
    config,
    setConfig,
  ] =
    useState<ZImageConfig>(
      () =>
        loadZImageConfig(),
    )

  const [
    prompt,
    setPrompt,
  ] = useState("")

  const [
    width,
    setWidth,
  ] = useState(768)

  const [
    height,
    setHeight,
  ] = useState(768)

  const [
    steps,
    setSteps,
  ] = useState(4)

  const [
    status,
    setStatus,
  ] =
    useState<GenerationStatus>(
      "idle",
    )

  const [
    progress,
    setProgress,
  ] = useState(0)

  const [
    error,
    setError,
  ] = useState("")

  const [
    generatedBlob,
    setGeneratedBlob,
  ] =
    useState<Blob | null>(
      null,
    )

  const [
    generatedMimeType,
    setGeneratedMimeType,
  ] = useState(
    "image/png",
  )

  const [
    generatedSeed,
    setGeneratedSeed,
  ] = useState<number | undefined>(
    undefined,
  )

  const [
    savedImageId,
    setSavedImageId,
  ] = useState<string | null>(
    null,
  )

  const [
    testing,
    setTesting,
  ] = useState(false)

  const [
    testMessage,
    setTestMessage,
  ] = useState("")

  const [
    showSettings,
    setShowSettings,
  ] = useState(false)

  const [
    controller,
    setController,
  ] =
    useState<AbortController | null>(
      null,
    )

  const previewUrl =
    useMemo(() => {
      if (!generatedBlob) {
        return null
      }

      return URL.createObjectURL(
        generatedBlob,
      )
    }, [
      generatedBlob,
    ])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }
    }
  }, [
    previewUrl,
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    setConfig(
      loadZImageConfig(),
    )

    setPrompt(
      buildCharacterPrompt(
        character,
      ),
    )

    setWidth(768)
    setHeight(1024)
    setSteps(8)

    setStatus("idle")
    setProgress(0)
    setError("")
    setGeneratedBlob(null)
    setGeneratedMimeType(
      "image/png",
    )
    setGeneratedSeed(
      undefined,
    )
    setSavedImageId(null)
    setTestMessage("")
  }, [
    open,
    character.id,
  ])

  function updateConfig(
    updates: Partial<ZImageConfig>,
  ) {
    const next = {
      ...config,
      ...updates,
    }

    setConfig(next)

    saveZImageConfig(
      next,
    )
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestMessage("")
    setError("")

    try {
      saveZImageConfig(
        config,
      )

      await testZImageConnection()

      setTestMessage(
        "Connected to the local LCM DreamShaper v7 service.",
      )
    } catch (testError) {
      setTestMessage(
        testError instanceof
          Error
          ? testError.message
          : "LCM DreamShaper v7 connection failed.",
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

    saveZImageConfig(
      config,
    )

    const abortController =
      new AbortController()

    setController(
      abortController,
    )

    setStatus(
      "generating",
    )

    setProgress(0)
    setError("")
    setGeneratedBlob(null)
    setGeneratedSeed(
      undefined,
    )
    setSavedImageId(null)

    try {
      const result =
        await generateImage(
          {
            prompt:
              prompt.trim(),

            width,

            height,

            steps,

            signal:
              abortController.signal,

            onProgress: (
              value,
            ) => {
              setProgress(
                value,
              )
            },
          },
        )

      setGeneratedBlob(
        result.blob,
      )

      setGeneratedMimeType(
        result.mimeType,
      )

      setGeneratedSeed(
        result.seed,
      )

      setProgress(100)
      setStatus("success")
    } catch (generationError) {
      if (
        generationError instanceof
          Error &&
        generationError.name ===
          "AbortError"
      ) {
        setStatus("idle")
        setProgress(0)

        return
      }

      setStatus("error")

      setError(
        generationError instanceof
          Error
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
    if (
      !generatedBlob
    ) {
      return
    }

    setStatus("saving")
    setError("")

    try {
      const now =
        new Date().toISOString()

      const imageId =
        createImageId()

      const image: MnemeonaImage =
        {
          id: imageId,

          projectId,

          name:
            `${
              character.name ||
              "Character"
            } portrait`,

          type:
            "character",

          entityId:
            character.id,

          mimeType:
            generatedMimeType,

          blob:
            generatedBlob,

          prompt:
            prompt.trim(),

          width,

          height,

          createdAt:
            now,

          updatedAt:
            now,
        }

      await saveImage(
        image,
      )

      setSavedImageId(
        imageId,
      )

      setStatus("success")

      onImageSaved?.(
        imageId,
      )
    } catch (saveError) {
      setStatus("error")

      setError(
        saveError instanceof
          Error
          ? saveError.message
          : "Failed to save image.",
      )
    }
  }

  function rebuildPrompt() {
    setPrompt(
      buildCharacterPrompt(
        character,
      ),
    )

    setGeneratedBlob(null)
    setGeneratedSeed(
      undefined,
    )
    setSavedImageId(null)
    setStatus("idle")
    setError("")
    setProgress(0)
  }

  const generating =
    status ===
    "generating"

  const saving =
    status ===
    "saving"

  return (
    <Dialog
      open={open}
      onOpenChange={(
        nextOpen,
      ) => {
        if (
          !nextOpen &&
          generating
        ) {
          controller?.abort()
        }

        onOpenChange(
          nextOpen,
        )
      }}
    >
      <DialogContent
        className="
          fixed
          left-1/2
          top-1/2
          z-[100]
          flex
          max-h-[92vh]
          w-[min(1000px,calc(100vw-2rem))]
          -translate-x-1/2
          -translate-y-1/2
          flex-col
          overflow-hidden
          rounded-2xl
          border
          bg-background
          p-0
          shadow-2xl
        "
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <ImagePlus className="size-5 text-primary" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-sm">
                Generate Character Image
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs">
                Generate a visual reference for{" "}
                <span className="font-medium text-foreground">
                  {character.name ||
                    "this character"}
                </span>{" "}
                using your local LCM DreamShaper v7 model.
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() =>
                onOpenChange(
                  false,
                )
              }
              disabled={
                generating ||
                saving
              }
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid min-h-full lg:grid-cols-[1fr_420px]">
            {/* Preview */}
            <section className="flex min-h-[420px] items-center justify-center border-b bg-muted/20 p-6 lg:border-b-0 lg:border-r">
              {previewUrl ? (
                <div className="flex max-h-[68vh] max-w-full flex-col items-center gap-3">
                  <img
                    src={previewUrl}
                    alt={`Generated portrait of ${
                      character.name ||
                      "character"
                    }`}
                    className="max-h-[64vh] max-w-full rounded-xl object-contain shadow-lg"
                  />

                  {generatedSeed !==
                    undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      Seed:{" "}
                      <span className="font-mono">
                        {
                          generatedSeed
                        }
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                    <Sparkles className="size-7 text-muted-foreground" />
                  </div>

                  <h3 className="text-sm font-medium">
                    No image generated yet
                  </h3>

                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Mnemeona will build a visual
                    prompt from the character profile.
                    Edit it before generating if you
                    want.
                  </p>
                </div>
              )}
            </section>

            {/* Controls */}
            <section className="space-y-5 p-6">
              {/* Z-Image settings */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Settings2 className="size-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          LCM DreamShaper v7
                        </p>

                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          Local image generation
                        </p>

                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {config.endpoint}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowSettings(
                            !showSettings,
                          )
                        }
                        disabled={
                          generating ||
                          saving
                        }
                      >
                        <Settings2 className="mr-1.5 size-3.5" />
                        Settings
                      </Button>
                    </div>

                    {showSettings && (
                      <div className="mt-4 space-y-3 border-t pt-4">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="zimage-endpoint"
                            className="text-xs font-medium"
                          >
                            Local image service URL
                          </label>

                          <Input
                            id="zimage-endpoint"
                            value={
                              config.endpoint
                            }
                            onChange={(
                              event,
                            ) =>
                              updateConfig({
                                endpoint:
                                  event
                                    .target
                                    .value,
                              })
                            }
                            placeholder="http://127.0.0.1:8199"
                            disabled={
                              generating ||
                              saving
                            }
                            className="h-8 text-xs"
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            testing ||
                            generating ||
                            saving
                          }
                          onClick={
                            handleTestConnection
                          }
                        >
                          {testing ? (
                            <>
                              <Loader2 className="mr-2 size-3.5 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 size-3.5" />
                              Test connection
                            </>
                          )}
                        </Button>

                        {testMessage && (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {testMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="character-image-prompt"
                    className="text-sm font-medium"
                  >
                    Image prompt
                  </label>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      generating ||
                      saving
                    }
                    onClick={
                      rebuildPrompt
                    }
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Rebuild
                  </Button>
                </div>

                <textarea
                  id="character-image-prompt"
                  value={prompt}
                  onChange={(
                    event,
                  ) =>
                    setPrompt(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    generating ||
                    saving
                  }
                  className="min-h-[210px] w-full resize-y rounded-xl border bg-background p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="image-width"
                    className="text-xs font-medium"
                  >
                    Width
                  </label>

                  <Input
                    id="image-width"
                    type="number"
                    min={512}
                    max={1536}
                    step={64}
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
                        ) ||
                          768,
                      )
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="image-height"
                    className="text-xs font-medium"
                  >
                    Height
                  </label>

                  <Input
                    id="image-height"
                    type="number"
                    min={512}
                    max={1536}
                    step={64}
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
                        ) ||
                          1024,
                      )
                    }
                  />
                </div>
              </div>

              {/* Generation parameters */}
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">
                      Turbo generation
                    </p>

                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        LCM DreamShaper v7 is optimized for high-quality
                        few-step generation on consumer hardware.
                    </p>
                  </div>

                  <div className="shrink-0 rounded-md bg-background px-2 py-1 text-[10px] font-medium">
                    8 steps
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <label
                    htmlFor="image-steps"
                    className="text-xs font-medium"
                  >
                    Steps
                  </label>

                  <Input
                    id="image-steps"
                    type="number"
                    min={1}
                    max={20}
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
                        ) ||
                          8,
                      )
                    }
                  />

                  <p className="text-[10px] text-muted-foreground">
                    Recommended: 8
                  </p>
                </div>
              </div>

              {/* Progress */}
              {generating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Generating with LCM DreamShaper v7...
                    </span>

                    <span className="font-medium">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground transition-all"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Generation runs locally on your
                    configured NVIDIA GPU.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs leading-relaxed text-destructive">
                    {error}
                  </p>
                </div>
              )}

              {savedImageId && (
                <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3">
                  <Check className="size-4" />

                  <span className="text-xs">
                    Image saved to this character.
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 border-t pt-4">
                {generating ? (
                  <Button
                    variant="outline"
                    onClick={
                      handleCancel
                    }
                  >
                    Cancel
                  </Button>
                ) : (
                  <>
                    {generatedBlob && (
                      <Button
                        variant="outline"
                        disabled={
                          saving ||
                          !!savedImageId
                        }
                        onClick={
                          handleSaveImage
                        }
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Saving...
                          </>
                        ) : savedImageId ? (
                          <>
                            <Check className="mr-2 size-4" />
                            Saved
                          </>
                        ) : (
                          <>
                            <ImagePlus className="mr-2 size-4" />
                            Save to character
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      onClick={
                        handleGenerate
                      }
                      disabled={
                        saving ||
                        testing
                      }
                    >
                      <Sparkles className="mr-2 size-4" />

                      {generatedBlob
                        ? "Generate another"
                        : "Generate image"}
                    </Button>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
