import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  X,
} from "lucide-react"

import {
  EditorContent,
  useEditor,
} from "@tiptap/react"

import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"

import type {
  Act,
  Chapter,
} from "@/types/manuscript"

import { Button } from "@/components/ui/button"

import { AITextMark } from "@/components/editor/AITextMark"

import "./ReadingMode.css"

type ReadingModeProps = {
  acts: Act[]
  initialChapterId?: string | null
  onClose: () => void
}

type ChapterLocation = {
  actIndex: number
  chapterIndex: number
}

export function ReadingMode({
  acts,
  initialChapterId = null,
  onClose,
}: ReadingModeProps) {
  const chapters = useMemo(() => {
    return acts.flatMap(
      (act, actIndex) =>
        act.chapters.map(
          (
            chapter,
            chapterIndex,
          ) => ({
            act,
            actIndex,
            chapter,
            chapterIndex,
          }),
        ),
    )
  }, [acts])

  const findChapterIndex = (
    chapterId: string | null | undefined,
  ): number => {
    if (!chapterId) {
      return 0
    }

    const index = chapters.findIndex(
      ({ chapter }) =>
        chapter.id === chapterId,
    )

    return index >= 0 ? index : 0
  }

  const [
    currentChapterIndex,
    setCurrentChapterIndex,
  ] = useState(() =>
    findChapterIndex(
      initialChapterId,
    ),
  )

  const [
    showChapterList,
    setShowChapterList,
  ] = useState(false)

  const currentChapterData =
    chapters[
      currentChapterIndex
    ]

  const currentChapter =
    currentChapterData?.chapter ?? null

  const currentAct =
    currentChapterData?.act ?? null

  const isFirstChapter =
    currentChapterIndex === 0

  const isLastChapter =
    currentChapterIndex ===
    chapters.length - 1

  const goToChapter = (
    index: number,
  ) => {
    if (
      index < 0 ||
      index >= chapters.length
    ) {
      return
    }

    setCurrentChapterIndex(
      index,
    )

    setShowChapterList(false)
  }

  const goToPreviousChapter =
    () => {
      if (isFirstChapter) {
        return
      }

      goToChapter(
        currentChapterIndex - 1,
      )
    }

  const goToNextChapter = () => {
    if (isLastChapter) {
      return
    }

    goToChapter(
      currentChapterIndex + 1,
    )
  }

  /*
   * --------------------------------------------------
   * Keyboard navigation
   * --------------------------------------------------
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
        event.preventDefault()
        onClose()
        return
      }

      if (
        event.key === "ArrowLeft" &&
        !showChapterList
      ) {
        event.preventDefault()
        goToPreviousChapter()
        return
      }

      if (
        event.key === "ArrowRight" &&
        !showChapterList
      ) {
        event.preventDefault()
        goToNextChapter()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [
    currentChapterIndex,
    showChapterList,
    onClose,
    isFirstChapter,
    isLastChapter,
  ])

  /*
   * --------------------------------------------------
   * Lock body scrolling while the reader is open
   * --------------------------------------------------
   */

  useEffect(() => {
    const originalOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      "hidden"

    return () => {
      document.body.style.overflow =
        originalOverflow
    }
  }, [])

  /*
   * --------------------------------------------------
   * Read-only Tiptap editor
   * --------------------------------------------------
   *
   * We use Tiptap purely as a renderer here.
   * No update handler is attached and the editor
   * is permanently non-editable.
   */

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      AITextMark,
    ],

    editable: false,

    content:
      currentChapter
        ? getChapterContent(
            currentChapter,
          )
        : {
            type: "doc",
            content: [],
          },

    editorProps: {
      attributes: {
        class:
          "reading-mode-prose focus:outline-none",
        spellcheck: "false",
      },
    },
  })

  /*
   * --------------------------------------------------
   * Update displayed chapter
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!editor) {
      return
    }

    const content =
      currentChapter
        ? getChapterContent(
            currentChapter,
          )
        : {
            type: "doc" as const,
            content: [],
          }

    editor.commands.setContent(
      content,
      {
        emitUpdate: false,
      },
    )

    editor.setEditable(false)

    /*
     * Always start each chapter at the
     * beginning of the reading page.
     */
    const frame =
      window.requestAnimationFrame(
        () => {
          const container =
            document.querySelector(
              "[data-reading-scroll]",
            )

          if (container) {
            container.scrollTo({
              top: 0,
              behavior: "instant",
            })
          }
        },
      )

    return () => {
      window.cancelAnimationFrame(
        frame,
      )
    }
  }, [
    editor,
    currentChapter?.id,
  ])

  /*
   * --------------------------------------------------
   * No chapters
   * --------------------------------------------------
   */

  if (!currentChapter) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center text-center">
          <BookOpen className="mb-4 size-10 text-muted-foreground" />

          <h1 className="text-lg font-medium">
            Nothing to read yet
          </h1>

          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Add a chapter and some scenes
            to your manuscript before
            opening Reading Mode.
          </p>

          <Button
            className="mt-6 gap-2"
            onClick={onClose}
          >
            <X className="size-4" />
            Close Reading Mode
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="reading-mode fixed inset-0 z-[200] flex h-screen flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Reading Mode"
    >
      {/* -------------------------------------------------- */}
      {/* Top Bar */}
      {/* -------------------------------------------------- */}

      <header className="reading-mode-header flex h-14 shrink-0 items-center border-b px-4">
        {/* Close */}

        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={onClose}
          title="Exit Reading Mode"
          aria-label="Exit Reading Mode"
        >
          <X className="size-4" />

          <span className="hidden sm:inline">
            Exit Reading
          </span>
        </Button>

        {/* Center title */}

        <div className="min-w-0 flex-1 px-4 text-center">
          <div className="truncate text-xs font-medium text-muted-foreground">
            {currentAct?.title}
          </div>

          <div className="truncate text-sm font-medium">
            {currentChapter.title}
          </div>
        </div>

        {/* Chapter list */}

        <Button
          variant={
            showChapterList
              ? "secondary"
              : "ghost"
          }
          size="sm"
          className="gap-2"
          onClick={() =>
            setShowChapterList(
              (value) => !value,
            )
          }
          title="Open chapter list"
          aria-label="Open chapter list"
          aria-expanded={
            showChapterList
          }
        >
          <List className="size-4" />

          <span className="hidden sm:inline">
            Chapters
          </span>

          <ChevronDown
            className={`size-3.5 transition-transform ${
              showChapterList
                ? "rotate-180"
                : ""
            }`}
          />
        </Button>
      </header>

      {/* -------------------------------------------------- */}
      {/* Main Reader Area */}
      {/* -------------------------------------------------- */}

      <div className="relative min-h-0 flex-1">
        {/* -------------------------------------------------- */}
        {/* Chapter Navigation Drawer */}
        {/* -------------------------------------------------- */}

        {showChapterList && (
          <>
            <button
              type="button"
              aria-label="Close chapter list"
              className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[1px]"
              onClick={() =>
                setShowChapterList(
                  false,
                )
              }
            />

            <aside className="reading-mode-chapter-drawer absolute bottom-0 left-0 top-0 z-30 flex w-[min(360px,90vw)] flex-col border-r bg-background shadow-2xl">
              <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <div>
                  <div className="text-sm font-medium">
                    Chapters
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {chapters.length}{" "}
                    {chapters.length ===
                    1
                      ? "chapter"
                      : "chapters"}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setShowChapterList(
                      false,
                    )
                  }
                  aria-label="Close chapter list"
                >
                  <X className="size-4" />
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {chapters.map(
                  (
                    item,
                    index,
                  ) => {
                    const isCurrent =
                      index ===
                      currentChapterIndex

                    return (
                      <button
                        key={
                          item.chapter
                            .id
                        }
                        type="button"
                        onClick={() =>
                          goToChapter(
                            index,
                          )
                        }
                        className={`mb-1 w-full rounded-lg px-3 py-3 text-left transition-colors ${
                          isCurrent
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="text-[10px] font-medium uppercase tracking-wider opacity-60">
                          {item.act
                            .title}
                        </div>

                        <div className="mt-1 text-sm font-medium">
                          {item.chapter
                            .title}
                        </div>

                        {item.chapter
                          .synopsis && (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {
                              item
                                .chapter
                                .synopsis
                            }
                          </div>
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            </aside>
          </>
        )}

        {/* -------------------------------------------------- */}
        {/* Scrollable Reading Surface */}
        {/* -------------------------------------------------- */}

        <main
          data-reading-scroll
          className="reading-mode-scroll h-full overflow-y-auto"
        >
          <article className="reading-mode-page mx-auto w-full max-w-3xl px-6 pb-40 pt-16 sm:px-10 sm:pt-20 lg:px-12">
            {/* Chapter heading */}

            <header className="mb-14 text-center">
              <div className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {currentAct?.title}
              </div>

              <h1 className="reading-mode-title text-3xl font-semibold tracking-tight sm:text-4xl">
                {currentChapter.title}
              </h1>

              {currentChapter
                .synopsis && (
                <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {
                    currentChapter.synopsis
                  }
                </p>
              )}

              <div className="mx-auto mt-8 h-px w-16 bg-border" />
            </header>

            {/* Chapter content */}

            {editor && (
              <div className="reading-mode-content">
                <EditorContent
                  editor={editor}
                />
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* Chapter Footer */}
            {/* -------------------------------------------------- */}

            <footer className="mt-24 border-t pt-8">
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={
                    isFirstChapter
                  }
                  onClick={
                    goToPreviousChapter
                  }
                  title="Previous chapter"
                >
                  <ArrowLeft className="size-4" />

                  <span className="hidden sm:inline">
                    Previous
                  </span>
                </Button>

                <div className="text-center text-xs text-muted-foreground">
                  <div>
                    Chapter{" "}
                    {currentChapterIndex +
                      1}{" "}
                    of{" "}
                    {chapters.length}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={
                    isLastChapter
                  }
                  onClick={
                    goToNextChapter
                  }
                  title="Next chapter"
                >
                  <span className="hidden sm:inline">
                    Next
                  </span>

                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </footer>
          </article>
        </main>

        {/* -------------------------------------------------- */}
        {/* Floating Chapter Navigation */}
        {/* -------------------------------------------------- */}

        {!showChapterList && (
          <>
            <button
              type="button"
              onClick={
                goToPreviousChapter
              }
              disabled={
                isFirstChapter
              }
              aria-label="Previous chapter"
              title="Previous chapter"
              className="reading-mode-side-nav reading-mode-side-nav-left"
            >
              <ChevronLeft className="size-5" />
            </button>

            <button
              type="button"
              onClick={
                goToNextChapter
              }
              disabled={
                isLastChapter
              }
              aria-label="Next chapter"
              title="Next chapter"
              className="reading-mode-side-nav reading-mode-side-nav-right"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/*
 * --------------------------------------------------
 * Helpers
 * --------------------------------------------------
 *
 * A chapter is composed of multiple scenes.
 * We render every scene consecutively while retaining
 * the scene title as a subtle divider.
 */

function getChapterContent(
  chapter: Chapter,
) {
  const content: Array<
    Record<string, unknown>
  > = []

  for (
    const scene of chapter.scenes
  ) {

    /*
     * Append the actual scene document.
     *
     * Tiptap documents have a root `doc`
     * node, so only its child nodes are
     * inserted into the chapter document.
     */
    if (
      scene.content &&
      Array.isArray(
        scene.content.content,
      )
    ) {
      content.push(
        ...scene.content.content,
      )
    }

    /*
     * Add visual breathing room between
     * scenes without inserting editable data
     * into the actual manuscript.
     */
    content.push({
      type: "paragraph",
      content: [],
    })
  }

  return {
    type: "doc" as const,
    content,
  }
}
