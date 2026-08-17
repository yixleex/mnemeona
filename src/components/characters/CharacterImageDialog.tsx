import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Check,
  ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import {
  Button,
} from "@/components/ui/button"

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
  deleteImage,
  listProjectImages,
} from "@/lib/imageDatabase"

interface CharacterImageDialogProps {
  open: boolean

  onOpenChange: (
    open: boolean,
  ) => void

  character: Character

  projectId: string

  onSelect: (
    imageId: string,
  ) => void

  onDelete?: (
    imageId: string,
    nextPrimaryImageId: string | null,
  ) => void | Promise<void>

  onGenerateImage?: () => void
}

interface CharacterImagePreview {
  image: MnemeonaImage
  url: string
}

export function CharacterImageDialog({
  open,
  onOpenChange,
  character,
  projectId,
  onSelect,
  onDelete,
  onGenerateImage,
}: CharacterImageDialogProps) {
  const [
    images,
    setImages,
  ] = useState<
    CharacterImagePreview[]
  >([])

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    deletingId,
    setDeletingId,
  ] = useState<
    string | null
  >(null)

  const [
    error,
    setError,
  ] = useState("")

  /*
   * Keep track of the currently allocated
   * object URLs independently from React state.
   *
   * This prevents cleanup from accidentally
   * revoking URLs for images that are still
   * displayed after another image is deleted.
   */
  const previewsRef = useRef<
    CharacterImagePreview[]
  >([])

  function revokePreviews(
    previews: CharacterImagePreview[],
  ) {
    previews.forEach(
      (preview) => {
        URL.revokeObjectURL(
          preview.url,
        )
      },
    )
  }

  function replacePreviews(
    next: CharacterImagePreview[],
  ) {
    revokePreviews(
      previewsRef.current,
    )

    previewsRef.current =
      next

    setImages(
      next,
    )
  }

  /*
   * Clean up all object URLs when the
   * component unmounts.
   */
  useEffect(() => {
    return () => {
      revokePreviews(
        previewsRef.current,
      )

      previewsRef.current = []
    }
  }, [])

  /*
   * Load all generated character images
   * whenever the dialog opens or the
   * character/project changes.
   */
  useEffect(() => {
    if (!open) {
      /*
       * Release previews while the dialog
       * is closed.
       */
      revokePreviews(
        previewsRef.current,
      )

      previewsRef.current = []

      setImages([])

      setSelectedId(null)

      setError("")

      setLoading(false)

      return
    }

    let cancelled = false

    async function loadImages() {
      setLoading(true)
      setError("")

      try {
        const projectImages =
          await listProjectImages(
            projectId,
          )

        if (cancelled) {
          return
        }

        const characterImages =
          projectImages
            .filter(
              (image) =>
                image.type ===
                  "character" &&
                image.entityId ===
                  character.id,
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt,
                ).getTime() -
                new Date(
                  a.createdAt,
                ).getTime(),
            )

        const nextPreviews =
          characterImages.map(
            (image) => ({
              image,
              url:
                URL.createObjectURL(
                  image.blob,
                ),
            }),
          )

        if (cancelled) {
          revokePreviews(
            nextPreviews,
          )

          return
        }

        replacePreviews(
          nextPreviews,
        )

        /*
         * Prefer the character's explicitly
         * selected primary image.
         *
         * Otherwise select the newest
         * available image.
         */
        const primaryExists =
          !!character.primaryImageId &&
          nextPreviews.some(
            (preview) =>
              preview.image.id ===
              character.primaryImageId,
          )

        if (primaryExists) {
          setSelectedId(
            character.primaryImageId!,
          )
        } else {
          setSelectedId(
            nextPreviews[0]
              ?.image.id ??
              null,
          )
        }
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Failed to load character images.",
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadImages()

    return () => {
      cancelled = true
    }
  }, [
    open,
    projectId,
    character.id,
    character.primaryImageId,
  ])

  const selectedImage =
    images.find(
      (preview) =>
        preview.image.id ===
        selectedId,
    ) ?? null

  async function handleDelete(
    imageId: string,
  ) {
    const preview =
      images.find(
        (item) =>
          item.image.id ===
          imageId,
      )

    if (!preview) {
      return
    }

    if (deletingId) {
      return
    }

    const isPrimary =
      character.primaryImageId ===
      imageId

    const confirmed =
      window.confirm(
        isPrimary
          ? "Delete this image? It is currently being used as this character's portrait."
          : "Delete this image permanently?",
      )

    if (!confirmed) {
      return
    }

    setDeletingId(
      imageId,
    )

    setError("")

    try {
      /*
       * Work out what should become the
       * primary image after deletion.
       *
       * Images are sorted newest-first,
       * so the newest remaining image is
       * used as the fallback.
       */
      const remaining =
        images.filter(
          (item) =>
            item.image.id !==
            imageId,
        )

      let nextPrimaryImageId:
        string | null

      if (isPrimary) {
        nextPrimaryImageId =
          remaining[0]
            ?.image.id ??
          null
      } else {
        nextPrimaryImageId =
          character.primaryImageId ??
          null
      }

      /*
       * Delete the actual Blob from IndexedDB.
       */
      await deleteImage(
        imageId,
      )

      /*
       * Release only the deleted image's
       * object URL.
       */
      URL.revokeObjectURL(
        preview.url,
      )

      /*
       * Keep the ref synchronized without
       * revoking the URLs of the remaining
       * images.
       */
      previewsRef.current =
        remaining

      setImages(
        remaining,
      )

      /*
       * If the deleted image was selected,
       * select the new primary image.
       *
       * Otherwise preserve the current
       * selection.
       */
      if (
        selectedId ===
        imageId
      ) {
        setSelectedId(
          nextPrimaryImageId,
        )
      }

      /*
       * Tell CharacterDatabase to update:
       *
       * - imageIds
       * - primaryImageId
       */
      await onDelete?.(
        imageId,
        nextPrimaryImageId,
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : "Failed to delete the image.",
      )
    } finally {
      setDeletingId(
        null,
      )
    }
  }

  function handleSelect() {
    if (!selectedId) {
      return
    }

    onSelect(
      selectedId,
    )

    onOpenChange(false)
  }

  function handleGenerateNew() {
    onOpenChange(false)

    onGenerateImage?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent
        showCloseButton={false}
        className="
          fixed
          left-1/2
          top-1/2
          z-[100]
          flex
          h-[min(760px,90vh)]
          w-[94vw]
          !max-w-[1080px]
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
            px-6
            py-5
            text-left
          "
        >
          <div
            className="
              flex
              items-center
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
                bg-primary/10
              "
            >
              <ImageIcon
                className="
                  size-5
                  text-primary
                "
              />
            </div>

            <div
              className="
                min-w-0
              "
            >
              <DialogTitle
                className="
                  text-base
                  font-semibold
                "
              >
                Character Images
              </DialogTitle>

              <DialogDescription
                className="
                  mt-1
                  text-xs
                "
              >
                Choose the image used for{" "}
                <span
                  className="
                    font-medium
                    text-foreground
                  "
                >
                  {character.name ||
                    "this character"}
                </span>
                .
              </DialogDescription>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="
                ml-auto
                size-8
              "
              onClick={() =>
                onOpenChange(false)
              }
              aria-label="Close character images"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            p-6
          "
        >
          {loading ? (
            <div
              className="
                flex
                h-full
                min-h-[300px]
                items-center
                justify-center
              "
            >
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-3
                "
              >
                <Loader2
                  className="
                    size-6
                    animate-spin
                    text-muted-foreground
                  "
                />

                <p
                  className="
                    text-xs
                    text-muted-foreground
                  "
                >
                  Loading character images...
                </p>
              </div>
            </div>
          ) : error ? (
            <div
              className="
                flex
                h-full
                min-h-[300px]
                items-center
                justify-center
              "
            >
              <div
                className="
                  max-w-sm
                  text-center
                "
              >
                <p
                  className="
                    text-sm
                    font-medium
                    text-destructive
                  "
                >
                  Image operation failed
                </p>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-relaxed
                    text-muted-foreground
                  "
                >
                  {error}
                </p>
              </div>
            </div>
          ) : images.length ===
            0 ? (
            <div
              className="
                flex
                h-full
                min-h-[300px]
                items-center
                justify-center
              "
            >
              <div
                className="
                  max-w-sm
                  text-center
                "
              >
                <div
                  className="
                    mx-auto
                    mb-5
                    flex
                    size-16
                    items-center
                    justify-center
                    rounded-2xl
                    bg-muted
                  "
                >
                  <Sparkles
                    className="
                      size-7
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
                  No character images yet
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-relaxed
                    text-muted-foreground
                  "
                >
                  Generate a character
                  image first, then you can
                  choose which generated image
                  should be used here.
                </p>

                {onGenerateImage && (
                  <Button
                    className="mt-5"
                    onClick={
                      handleGenerateNew
                    }
                  >
                    <Sparkles
                      className="
                        mr-2
                        size-4
                      "
                    />
                    Generate image
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div
              className="
                grid
                gap-6
                lg:grid-cols-[minmax(0,1fr)_300px]
              "
            >
              {/* Image grid */}
              <div
                className="
                  min-w-0
                "
              >
                <div
                  className="
                    mb-4
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <h3
                      className="
                        text-sm
                        font-medium
                      "
                    >
                      Generated images
                    </h3>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-muted-foreground
                      "
                    >
                      {images.length}{" "}
                      {images.length ===
                      1
                        ? "image"
                        : "images"}{" "}
                      available
                    </p>
                  </div>

                  {onGenerateImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={
                        handleGenerateNew
                      }
                    >
                      <Plus
                        className="
                          mr-1.5
                          size-3.5
                        "
                      />
                      Generate new
                    </Button>
                  )}
                </div>

                <div
                  className="
                    grid
                    grid-cols-2
                    gap-3
                    sm:grid-cols-3
                  "
                >
                  {images.map(
                    (preview) => {
                      const selected =
                        preview.image.id ===
                        selectedId

                      const primary =
                        character.primaryImageId ===
                        preview.image.id

                      const deleting =
                        deletingId ===
                        preview.image.id

                      return (
                        <div
                          key={
                            preview.image.id
                          }
                          className={`
                            group
                            relative
                            overflow-hidden
                            rounded-xl
                            border
                            bg-muted
                            transition
                            ${
                              selected
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                : "hover:border-foreground/40"
                            }
                          `}
                        >
                          {/* Image selection */}
                          <button
                            type="button"
                            disabled={
                              deleting
                            }
                            onClick={() =>
                              setSelectedId(
                                preview
                                  .image
                                  .id,
                              )
                            }
                            className="
                              block
                              w-full
                              text-left
                              disabled:cursor-wait
                            "
                            aria-label={`Select ${preview.image.name}`}
                          >
                            <div
                              className="
                                aspect-[3/4]
                                w-full
                              "
                            >
                              <img
                                src={
                                  preview.url
                                }
                                alt={
                                  preview
                                    .image
                                    .name
                                }
                                className="
                                  size-full
                                  object-cover
                                  transition
                                  duration-200
                                  group-hover:scale-[1.02]
                                "
                              />
                            </div>
                          </button>

                          {/* Selected indicator */}
                          {selected && (
                            <div
                              className="
                                pointer-events-none
                                absolute
                                right-2
                                top-2
                                z-10
                                flex
                                size-8
                                items-center
                                justify-center
                                rounded-full
                                border-2
                                border-background
                                bg-primary
                                text-primary-foreground
                                shadow-xl
                              "
                              title="Selected"
                            >
                              <Check
                                className="
                                  size-4
                                  stroke-[3]
                                "
                              />
                            </div>
                            )}

                          {/* Delete button */}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            disabled={deleting}
                            aria-label={`Delete ${preview.image.name}`}
                            title="Delete image"
                            onClick={(event) => {
                              event.stopPropagation()

                              void handleDelete(
                                preview.image.id,
                              )
                            }}
                            className="
                              absolute
                              bottom-2
                              right-2
                              z-10
                              size-9
                              rounded-lg
                              border-2
                              border-background
                              bg-destructive
                              text-destructive-foreground
                              opacity-0
                              shadow-xl
                              translate-y-1
                              transition-all
                              duration-150
                              hover:bg-destructive/90
                              hover:scale-105
                              group-hover:translate-y-0
                              group-hover:opacity-100
                              focus-visible:translate-y-0
                              focus-visible:opacity-100
                              focus-visible:ring-2
                              focus-visible:ring-destructive
                              focus-visible:ring-offset-2
                            "
                          >
                            {deleting ? (
                              <Loader2
                                className="
                                  size-4
                                  animate-spin
                                "
                              />
                            ) : (
                              <Trash2
                                className="
                                  size-4
                                  stroke-[2.5]
                                "
                              />
                            )}
                          </Button>

                          {/* Current portrait */}
                          {primary && (
                            <div
                              className="
                                pointer-events-none
                                absolute
                                bottom-2
                                left-2
                                rounded-full
                                bg-background/90
                                px-2
                                py-1
                                text-[9px]
                                font-medium
                                shadow
                                backdrop-blur
                              "
                            >
                              Current
                            </div>
                          )}
                        </div>
                      )
                    },
                  )}
                </div>
              </div>

              {/* Selected image */}
              <aside
                className="
                  rounded-2xl
                  border
                  bg-muted/20
                  p-4
                "
              >
                {selectedImage ? (
                  <>
                    <div
                      className="
                        overflow-hidden
                        rounded-xl
                        border
                        bg-black/10
                      "
                    >
                      <img
                        src={
                          selectedImage.url
                        }
                        alt={
                          selectedImage
                            .image
                            .name
                        }
                        className="
                          max-h-[430px]
                          w-full
                          object-contain
                        "
                      />
                    </div>

                    <div
                      className="
                        mt-4
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
                              truncate
                              text-sm
                              font-medium
                            "
                          >
                            {
                              selectedImage
                                .image
                                .name
                            }
                          </p>

                          <p
                            className="
                              mt-1
                              text-[10px]
                              text-muted-foreground
                            "
                          >
                            {
                              selectedImage
                                .image
                                .width
                            }{" "}
                            ×{" "}
                            {
                              selectedImage
                                .image
                                .height
                            }
                          </p>
                        </div>

                        {/* Delete selected image */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          disabled={
                            deletingId ===
                            selectedImage
                              .image
                              .id
                          }
                          aria-label="Delete selected image"
                          title="Delete selected image"
                          onClick={() =>
                            void handleDelete(
                              selectedImage
                                .image
                                .id,
                            )
                          }
                          className="
                            size-8
                            shrink-0
                          "
                        >
                          {deletingId ===
                          selectedImage
                            .image
                            .id ? (
                            <Loader2
                              className="
                                size-4
                                animate-spin
                              "
                            />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>

                      <p
                        className="
                          mt-3
                          line-clamp-5
                          text-[10px]
                          leading-relaxed
                          text-muted-foreground
                        "
                      >
                        {
                          selectedImage
                            .image
                            .prompt
                        }
                      </p>
                    </div>
                  </>
                ) : (
                  <div
                    className="
                      flex
                      h-full
                      min-h-[300px]
                      items-center
                      justify-center
                      text-center
                    "
                  >
                    <p
                      className="
                        text-xs
                        text-muted-foreground
                      "
                    >
                      Select an image.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="
            shrink-0
            border-t
            bg-background
            px-6
            py-4
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
            <p
              className="
                text-[10px]
                text-muted-foreground
              "
            >
              Select an image to use it as
              the character's primary visual
              reference. Deleted images are
              permanently removed.
            </p>

            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <Button
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Cancel
              </Button>

              <Button
                disabled={
                  !selectedId ||
                  loading ||
                  !!deletingId
                }
                onClick={
                  handleSelect
                }
              >
                <Check
                  className="
                    mr-2
                    size-4
                  "
                />
                Use selected image
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
