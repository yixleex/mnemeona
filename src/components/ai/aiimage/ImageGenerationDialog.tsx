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
  loadLCMConfig,
  saveLCMConfig,
  testLCMConnection,
  type LCMConfig,
} from "./lcmImageProvider"

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
  const sections: string[] = []

  sections.push(
    `A high-quality portrait of ${
      character.name ||
      "this character"
    }.`,
  )

  if (character.age.trim()) {
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

  if (character.role.trim()) {
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
  ] = useState<LCMConfig>(
    () => loadLCMConfig(),
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
  ] = useState(1024)

  const [
    steps,
    setSteps,
  ] = useState(4)

  const [
    status,
    setStatus,
  ] = useState<GenerationStatus>(
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
  ] = useState<Blob | null>(
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
    }, [generatedBlob])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!open) {
      return
    }

    setConfig(
      loadLCMConfig(),
    )

    setPrompt(
      buildCharacterPrompt(
        character,
      ),
    )

    setWidth(768)
    setHeight(768)
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
    setShowSettings(false)
  }, [
    open,
    character.id,
  ])

  function updateConfig(
    updates: Partial<LCMConfig>,
  ) {
    const next = {
      ...config,
      ...updates,
    }

    setConfig(next)

    saveLCMConfig(next)
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestMessage("")
    setError("")

    try {
      saveLCMConfig(config)

      await testLCMConnection()

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

    saveLCMConfig(config)

    const abortController =
      new AbortController()

    setController(
      abortController,
    )

    setStatus("generating")
    setProgress(0)
    setError("")
    setGeneratedBlob(null)
    setGeneratedSeed(
      undefined,
    )
    setSavedImageId(null)

    try {
      const result =
        await generateImage({
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
            setProgress(value)
          },
        })

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
    if (!generatedBlob) {
      return
    }

    setStatus("saving")
    setError("")

    try {
      const now =
        new Date().toISOString()

      const imageId =
        createImageId()

      const image: MnemeonaImage = {
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

      await saveImage(image)

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
    status === "generating"

  const saving =
    status === "saving"

  const hasImage =
    generatedBlob !== null

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

        onOpenChange(nextOpen)
      }}
    >
    <DialogContent
      showCloseButton={false}
      className="
        fixed
        left-1/2
        top-1/2
        z-[100]
        flex
        h-[min(900px,92vh)]
        w-[94vw]
        !max-w-[1180px]
        -translate-x-1/2
        -translate-y-1/2
        flex-col
        gap-0
        overflow-hidden
        rounded-2xl
        border
        bg-background
        p-0
        shadow-2xl
      "
    >
        {/* Header */}
        <DialogHeader
          className="
            shrink-0
            border-b
            px-7
            py-5
            text-left
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                size-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-primary/10
              "
            >
              <ImagePlus
                className="
                  size-5
                  text-primary
                "
              />
            </div>

            <div className="min-w-0">
              <DialogTitle
                className="
                  text-base
                  font-semibold
                "
              >
                Generate Character Image
              </DialogTitle>

              <DialogDescription
                className="
                  mt-1
                  text-xs
                "
              >
                Generate a visual reference
                for{" "}
                <span
                  className="
                    font-medium
                    text-foreground
                  "
                >
                  {character.name ||
                    "this character"}
                </span>{" "}
                using your local LCM
                DreamShaper v7 model.
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="
                ml-auto
                size-8
                shrink-0
              "
              onClick={() =>
                onOpenChange(false)
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

        {/* Main content */}
        <div
          className="
            min-h-0
            flex-1
            overflow-hidden
          "
        >
          <div
            className="
              grid
              h-full
              grid-cols-1
              lg:grid-cols-[420px_minmax(0,1fr)]
            "
          >
            {/* ========================= */}
            {/* Preview */}
            {/* ========================= */}

            <section
              className="
                flex
                min-h-0
                flex-col
                border-b
                bg-muted/10
                lg:border-b-0
                lg:border-r
              "
            >
              <div
                className="
                  flex
                  min-h-0
                  flex-1
                  items-center
                  justify-center
                  overflow-hidden
                  p-7
                "
              >
                {previewUrl ? (
                  <div
                    className="
                      flex
                      max-h-full
                      max-w-full
                      flex-col
                      items-center
                      gap-3
                    "
                  >
                    <div
                      className="
                        relative
                        flex
                        max-h-[65vh]
                        max-w-full
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-2xl
                        border
                        bg-black/20
                        shadow-xl
                      "
                    >
                      <img
                        src={previewUrl}
                        alt={`Generated portrait of ${
                          character.name ||
                          "character"
                        }`}
                        className="
                          block
                          max-h-[65vh]
                          max-w-full
                          object-contain
                        "
                      />
                    </div>

                    {generatedSeed !==
                      undefined && (
                      <div
                        className="
                          rounded-full
                          border
                          bg-background/80
                          px-3
                          py-1
                          text-[10px]
                          text-muted-foreground
                        "
                      >
                        Seed:{" "}
                        <span
                          className="
                            font-mono
                            text-foreground
                          "
                        >
                          {
                            generatedSeed
                          }
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="
                      flex
                      max-w-xs
                      flex-col
                      items-center
                      text-center
                    "
                  >
                    <div
                      className="
                        mb-5
                        flex
                        size-20
                        items-center
                        justify-center
                        rounded-2xl
                        border
                        bg-muted
                      "
                    >
                      <Sparkles
                        className="
                          size-8
                          text-muted-foreground
                        "
                      />
                    </div>

                    <h3
                      className="
                        text-sm
                        font-medium
                      "
                    >
                      No image generated yet
                    </h3>

                    <p
                      className="
                        mt-2
                        text-xs
                        leading-relaxed
                        text-muted-foreground
                      "
                    >
                      Mnemeona will build a
                      visual prompt from the
                      character profile. You
                      can edit it before
                      generating.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview metadata */}
              <div
                className="
                  shrink-0
                  border-t
                  px-6
                  py-4
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div className="min-w-0">
                    <p
                      className="
                        text-[11px]
                        font-medium
                      "
                    >
                      Visual reference
                    </p>

                    <p
                      className="
                        mt-0.5
                        truncate
                        text-[10px]
                        text-muted-foreground
                      "
                    >
                      {width} × {height}
                    </p>
                  </div>

                  {hasImage && (
                    <div
                      className="
                        flex
                        items-center
                        gap-1.5
                        rounded-full
                        bg-primary/10
                        px-2.5
                        py-1
                        text-[10px]
                        font-medium
                        text-primary
                      "
                    >
                      <Check className="size-3" />
                      Generated
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ========================= */}
            {/* Controls */}
            {/* ========================= */}

            <section
              className="
                min-h-0
                overflow-y-auto
                bg-background
              "
            >
              <div
                className="
                  space-y-5
                  p-6
                  xl:p-7
                "
              >
                {/* Model */}
                <div
                  className="
                    rounded-xl
                    border
                    bg-card
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      items-start
                      gap-3
                    "
                  >
                    <div
                      className="
                        flex
                        size-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-muted
                      "
                    >
                      <Settings2
                        className="
                          size-4
                          text-muted-foreground
                        "
                      />
                    </div>

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div
                          className="
                            min-w-0
                          "
                        >
                          <p
                            className="
                              text-sm
                              font-medium
                            "
                          >
                            LCM DreamShaper v7
                          </p>

                          <p
                            className="
                              mt-1
                              text-[11px]
                              text-muted-foreground
                            "
                          >
                            Local image
                            generation
                            service
                          </p>

                          <p
                            className="
                              mt-0.5
                              truncate
                              text-[10px]
                              text-muted-foreground
                            "
                          >
                            {config.endpoint}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="
                            shrink-0
                          "
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
                          <Settings2
                            className="
                              mr-1.5
                              size-3.5
                            "
                          />
                          Settings
                        </Button>
                      </div>

                      {showSettings && (
                        <div
                          className="
                            mt-4
                            space-y-3
                            border-t
                            pt-4
                          "
                        >
                          <div
                            className="
                              space-y-1.5
                            "
                          >
                            <label
                              htmlFor="lcm-endpoint"
                              className="
                                text-xs
                                font-medium
                              "
                            >
                              Local image
                              service URL
                            </label>

                            <Input
                              id="lcm-endpoint"
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
                              className="
                                h-9
                                text-xs
                              "
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
                                <Loader2
                                  className="
                                    mr-2
                                    size-3.5
                                    animate-spin
                                  "
                                />
                                Testing...
                              </>
                            ) : (
                              <>
                                <Check
                                  className="
                                    mr-2
                                    size-3.5
                                  "
                                />
                                Test connection
                              </>
                            )}
                          </Button>

                          {testMessage && (
                            <p
                              className="
                                text-[11px]
                                leading-relaxed
                                text-muted-foreground
                              "
                            >
                              {testMessage}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                <div
                  className="
                    space-y-2
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >
                    <div>
                      <label
                        htmlFor="character-image-prompt"
                        className="
                          text-sm
                          font-medium
                        "
                      >
                        Image prompt
                      </label>

                      <p
                        className="
                          mt-0.5
                          text-[10px]
                          text-muted-foreground
                        "
                      >
                        Describe the visual
                        reference you want.
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="
                        shrink-0
                      "
                      disabled={
                        generating ||
                        saving
                      }
                      onClick={
                        rebuildPrompt
                      }
                    >
                      <RefreshCw
                        className="
                          mr-1.5
                          size-3.5
                        "
                      />
                      Rebuild from profile
                    </Button>
                  </div>

                  <textarea
                    id="character-image-prompt"
                    value={prompt}
                    onChange={(
                      event,
                    ) =>
                      setPrompt(
                        event.target.value,
                      )
                    }
                    disabled={
                      generating ||
                      saving
                    }
                    className="
                      min-h-[220px]
                      w-full
                      resize-y
                      rounded-xl
                      border
                      bg-background
                      p-4
                      text-xs
                      leading-relaxed
                      outline-none
                      transition
                      focus:ring-2
                      focus:ring-ring"
                  />
                </div>

                {/* Image size + steps */}
                <div
                  className="
                    grid
                    gap-4
                    sm:grid-cols-2
                  "
                >
                  {/* Image size */}
                  <div
                    className="
                      rounded-xl
                      border
                      bg-card
                      p-4
                    "
                  >
                    <div>
                      <p
                        className="
                          text-sm
                          font-medium
                        "
                      >
                        Image size
                      </p>

                      <p
                        className="
                          mt-1
                          text-[10px]
                          leading-relaxed
                          text-muted-foreground
                        "
                      >
                        Portrait (768 × 1024)
                        is ideal for
                        characters.
                      </p>
                    </div>

                    <div
                      className="
                        mt-4
                        grid
                        grid-cols-2
                        gap-3
                      "
                    >
                      <div
                        className="
                          space-y-1.5
                        "
                      >
                        <label
                          htmlFor="image-width"
                          className="
                            text-[11px]
                            font-medium
                          "
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
                          className="
                            h-9
                            text-xs
                          "
                        />
                      </div>

                      <div
                        className="
                          space-y-1.5
                        "
                      >
                        <label
                          htmlFor="image-height"
                          className="
                            text-[11px]
                            font-medium
                          "
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
                          className="
                            h-9
                            text-xs
                          "
                        />
                      </div>
                    </div>
                  </div>

                  {/* Steps */}
                  <div
                    className="
                      rounded-xl
                      border
                      bg-card
                      p-4
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-3
                      "
                    >
                      <div>
                        <p
                          className="
                            text-sm
                            font-medium
                          "
                        >
                          Generation steps
                        </p>

                        <p
                          className="
                            mt-1
                            text-[10px]
                            leading-relaxed
                            text-muted-foreground
                          "
                        >
                          LCM is optimized
                          for few-step
                          generation.
                        </p>
                      </div>

                      <span
                        className="
                          shrink-0
                          rounded-full
                          bg-primary/10
                          px-2
                          py-1
                          text-[9px]
                          font-medium
                          text-primary
                        "
                      >
                        4 recommended
                      </span>
                    </div>

                    <div
                      className="
                        mt-4
                        space-y-1.5
                      "
                    >
                      <label
                        htmlFor="image-steps"
                        className="
                          text-[11px]
                          font-medium
                        "
                      >
                        Steps
                      </label>

                      <Input
                        id="image-steps"
                        type="number"
                        min={1}
                        max={8}
                        value={steps}
                        disabled={
                          generating ||
                          saving
                        }
                        onChange={(
                          event,
                        ) =>
                          setSteps(
                            Math.min(
                              8,
                              Math.max(
                                1,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) || 4,
                              ),
                            ),
                          )
                        }
                        className="
                          h-9
                          text-xs
                        "
                      />

                      <p
                        className="
                          text-[10px]
                          text-muted-foreground
                        "
                      >
                        Recommended:
                        4 steps
                      </p>
                    </div>
                  </div>
                </div>

                {/* Generation status */}
                {generating && (
                  <div
                    className="
                      rounded-xl
                      border
                      bg-muted/20
                      p-4
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <Loader2
                          className="
                            size-4
                            animate-spin
                          "
                        />

                        <span
                          className="
                            text-xs
                            font-medium
                          "
                        >
                          Generating image...
                        </span>
                      </div>

                      <span
                        className="
                          text-xs
                          font-medium
                        "
                      >
                        {progress}%
                      </span>
                    </div>

                    <div
                      className="
                        mt-3
                        h-1.5
                        overflow-hidden
                        rounded-full
                        bg-muted
                      "
                    >
                      <div
                        className="
                          h-full
                          rounded-full
                          bg-primary
                          transition-all
                        "
                        style={{
                          width:
                            `${progress}%`,
                        }}
                      />
                    </div>

                    <p
                      className="
                        mt-2
                        text-[10px]
                        text-muted-foreground
                      "
                    >
                      Generation runs
                      locally on your
                      configured NVIDIA GPU.
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div
                    className="
                      rounded-xl
                      border
                      border-destructive/30
                      bg-destructive/5
                      p-4
                    "
                  >
                    <p
                      className="
                        text-xs
                        leading-relaxed
                        text-destructive
                      "
                    >
                      {error}
                    </p>
                  </div>
                )}

                {/* Saved */}
                {savedImageId && (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      rounded-xl
                      border
                      bg-primary/5
                      p-3
                    "
                  >
                    <div
                      className="
                        flex
                        size-7
                        items-center
                        justify-center
                        rounded-full
                        bg-primary/10
                      "
                    >
                      <Check
                        className="
                          size-3.5
                          text-primary
                        "
                      />
                    </div>

                    <div>
                      <p
                        className="
                          text-xs
                          font-medium
                        "
                      >
                        Image saved
                      </p>

                      <p
                        className="
                          text-[10px]
                          text-muted-foreground
                        "
                      >
                        This visual reference
                        is attached to{" "}
                        {character.name ||
                          "the character"}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div
          className="
            shrink-0
            border-t
            bg-background
            px-6
            py-4
            xl:px-7
          "
        >
          <div
            className="
              flex
              flex-col
              gap-3
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            {/* Status */}
            <div
              className="
                flex
                min-w-0
                items-center
                gap-3
              "
            >
              <div
                className="
                  flex
                  size-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-muted
                "
              >
                {generating ? (
                  <Loader2
                    className="
                      size-4
                      animate-spin
                    "
                  />
                ) : savedImageId ? (
                  <Check
                    className="
                      size-4
                      text-primary
                    "
                  />
                ) : (
                  <Sparkles
                    className="
                      size-4
                    "
                  />
                )}
              </div>

              <div
                className="
                  min-w-0
                "
              >
                <p
                  className="
                    text-xs
                    font-medium
                  "
                >
                  {generating
                    ? "Generating your visual reference"
                    : savedImageId
                      ? "Image saved to character"
                      : hasImage
                        ? "Ready to save"
                        : "Ready to generate"}
                </p>

                <p
                  className="
                    mt-0.5
                    truncate
                    text-[10px]
                    text-muted-foreground
                  "
                >
                  {generating
                    ? "The image is being generated locally."
                    : hasImage
                      ? "You can save this image or generate another."
                      : "Click Generate image to create a visual reference."}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div
              className="
                flex
                shrink-0
                items-center
                gap-2
              "
            >
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
                  {hasImage && (
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
                          <Loader2
                            className="
                              mr-2
                              size-4
                              animate-spin
                            "
                          />
                          Saving...
                        </>
                      ) : savedImageId ? (
                        <>
                          <Check
                            className="
                              mr-2
                              size-4
                            "
                          />
                          Saved
                        </>
                      ) : (
                        <>
                          <ImagePlus
                            className="
                              mr-2
                              size-4
                            "
                          />
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
                    className="
                      min-w-[150px]
                    "
                  >
                    <Sparkles
                      className="
                        mr-2
                        size-4
                      "
                    />

                    {hasImage
                      ? "Generate another"
                      : "Generate image"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
