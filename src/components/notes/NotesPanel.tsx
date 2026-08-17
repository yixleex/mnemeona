import {
  useMemo,
  useState,
} from "react"

import {
  Plus,
  Save,
  StickyNote,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react"

import {
  Button,
} from "@/components/ui/button"

import {
  Textarea,
} from "@/components/ui/textarea"

import {
  Input,
} from "@/components/ui/input"

import {
  useProject,
} from "@/context/ProjectContext"

import {
  STORY_NOTE_TYPES,
  type StoryNote,
  type StoryNoteType,
} from "@/types/notes"


/*
 * --------------------------------------------------
 * Helpers
 * --------------------------------------------------
 */

function createNote(
  type: StoryNoteType,
): StoryNote {
  const now =
    new Date().toISOString()

  const definition =
    STORY_NOTE_TYPES.find(
      (item) =>
        item.type === type,
    )

  return {
    id: crypto.randomUUID(),

    type,

    title:
      definition?.label ??
      "New Note",

    content: "",

    enabled: true,

    createdAt: now,

    updatedAt: now,
  }
}


/*
 * --------------------------------------------------
 * Component
 * --------------------------------------------------
 */

export function NotesPanel() {
  const {
    project,
    updateProject,
  } = useProject()

  /*
   * project.notes is now properly typed as
   * StoryNote[], so no unsafe casts are required.
   */

  const notes =
    project.notes

  const [
    selectedId,
    setSelectedId,
  ] = useState<
    string | null
  >(
    notes[0]?.id ??
      null,
  )

  /*
   * --------------------------------------------------
   * Selected note
   * --------------------------------------------------
   */

  const selectedNote =
    useMemo(
      () =>
        notes.find(
          (note) =>
            note.id ===
            selectedId,
        ) ??
        notes[0] ??
        null,
      [
        notes,
        selectedId,
      ],
    )

  /*
   * --------------------------------------------------
   * Update note
   * --------------------------------------------------
   */

  const updateNote =
    (
      updates: Partial<StoryNote>,
    ) => {
      if (!selectedNote) {
        return
      }

      updateProject(
        (current) => ({
          ...current,

          notes:
            current.notes.map(
              (note) =>
                note.id ===
                selectedNote.id
                  ? {
                      ...note,

                      ...updates,

                      updatedAt:
                        new Date().toISOString(),
                    }
                  : note,
            ),

          updatedAt:
            new Date().toISOString(),
        }),
      )
    }

  /*
   * --------------------------------------------------
   * Add note
   * --------------------------------------------------
   */

  const addNote =
    (
      type: StoryNoteType =
        "authors-note",
    ) => {
      const note =
        createNote(type)

      updateProject(
        (current) => ({
          ...current,

          notes: [
            ...current.notes,
            note,
          ],

          updatedAt:
            new Date().toISOString(),
        }),
      )

      setSelectedId(
        note.id,
      )
    }

  /*
   * --------------------------------------------------
   * Delete note
   * --------------------------------------------------
   */

  const deleteNote =
    () => {
      if (!selectedNote) {
        return
      }

      const remaining =
        notes.filter(
          (note) =>
            note.id !==
            selectedNote.id,
        )

      updateProject(
        (current) => ({
          ...current,

          notes: remaining,

          updatedAt:
            new Date().toISOString(),
        }),
      )

      setSelectedId(
        remaining[0]?.id ??
          null,
      )
    }

  /*
   * --------------------------------------------------
   * Change note type
   * --------------------------------------------------
   */

  const changeNoteType =
    (
      type: StoryNoteType,
    ) => {
      if (!selectedNote) {
        return
      }

      const definition =
        STORY_NOTE_TYPES.find(
          (item) =>
            item.type === type,
        )

      updateNote({
        type,

        /*
         * If the title was still the previous
         * automatic category title, update it
         * to the new category title.
         *
         * If the user customized the title,
         * preserve their custom title.
         */
        title:
          selectedNote.title ===
            STORY_NOTE_TYPES.find(
              (item) =>
                item.type ===
                selectedNote.type,
            )?.label
            ? definition?.label ??
              selectedNote.title
            : selectedNote.title,
      })
    }

  /*
   * --------------------------------------------------
   * Render
   * --------------------------------------------------
   */

  return (
    <div className="flex min-h-0 flex-1">

      {/* ================================================== */}
      {/* Notes List */}
      {/* ================================================== */}

      <aside className="flex w-72 shrink-0 flex-col border-r">

        {/* -------------------------------------------------- */}
        {/* Header */}
        {/* -------------------------------------------------- */}

        <header className="flex h-14 items-center justify-between border-b px-4">

          <div className="flex items-center gap-2">

            <StickyNote className="size-4" />

            <span className="font-medium">
              Notes
            </span>

          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              addNote()
            }
            title="New note"
            aria-label="New note"
          >
            <Plus className="size-4" />
          </Button>

        </header>

        {/* -------------------------------------------------- */}
        {/* Note list */}
        {/* -------------------------------------------------- */}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">

          {notes.length ===
          0 ? (

            <div className="p-4">

              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">

                <StickyNote className="size-5 text-muted-foreground" />

              </div>

              <div className="text-sm font-medium">
                No notes yet
              </div>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Create persistent instructions,
                plot information, character arcs,
                world rules, and other guidance
                for your AI.
              </p>

              <Button
                size="sm"
                className="mt-4 gap-2"
                onClick={() =>
                  addNote(
                    "authors-note",
                  )
                }
              >
                <Plus className="size-3.5" />
                Create note
              </Button>

            </div>

          ) : (

            <div className="space-y-1">

              {notes.map(
                (
                  note,
                ) => {

                  const definition =
                    STORY_NOTE_TYPES.find(
                      (
                        item,
                      ) =>
                        item.type ===
                        note.type,
                    )

                  const isSelected =
                    selectedNote?.id ===
                    note.id

                  return (
                    <button
                      key={
                        note.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          note.id,
                        )
                      }
                      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-secondary"
                          : "hover:bg-muted"
                      }`}
                    >

                      <div className="flex items-center gap-2">

                        <div
                          className={`size-1.5 shrink-0 rounded-full ${
                            note.enabled
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                        />

                        <div className="min-w-0 flex-1">

                          <div className="truncate text-sm font-medium">

                            {note.title ||
                              definition?.label ||
                              "Note"}

                          </div>

                          <div className="truncate text-xs text-muted-foreground">

                            {definition?.label ??
                              note.type}

                          </div>

                        </div>

                      </div>

                    </button>
                  )
                },
              )}

            </div>

          )}

        </div>

        {/* -------------------------------------------------- */}
        {/* Footer */}
        {/* -------------------------------------------------- */}

        {notes.length >
          0 && (

          <div className="border-t px-3 py-3">

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() =>
                addNote()
              }
            >
              <Plus className="size-3.5" />
              New Note
            </Button>

          </div>

        )}

      </aside>


      {/* ================================================== */}
      {/* Note Editor */}
      {/* ================================================== */}

      <section className="flex min-w-0 flex-1 flex-col">

        {!selectedNote ? (

          <div className="flex flex-1 items-center justify-center">

            <div className="max-w-md px-6 text-center">

              <StickyNote className="mx-auto mb-4 size-8 text-muted-foreground/50" />

              <h2 className="text-sm font-medium">
                Select a note
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Notes give the AI persistent
                information about your story
                that shouldn't disappear when
                the scene changes.
              </p>

            </div>

          </div>

        ) : (

          <>

            {/* ================================================== */}
            {/* Header */}
            {/* ================================================== */}

            <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2">

              <Input
                value={
                  selectedNote.title
                }
                onChange={(
                  event,
                ) =>
                  updateNote({
                    title:
                      event.target
                        .value,
                  })
                }
                placeholder="Note title"
                className="min-w-[180px] max-w-xl flex-1 text-base font-medium"
              />

              <select
                value={
                  selectedNote.type
                }
                onChange={(
                  event,
                ) =>
                  changeNoteType(
                    event.target
                      .value as StoryNoteType,
                  )
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Note type"
              >

                {STORY_NOTE_TYPES.map(
                  (
                    item,
                  ) => (

                    <option
                      key={
                        item.type
                      }
                      value={
                        item.type
                      }
                    >
                      {item.label}
                    </option>

                  ),
                )}

              </select>

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">

                <input
                  type="checkbox"
                  checked={
                    selectedNote.enabled
                  }
                  onChange={(
                    event,
                  ) =>
                    updateNote({
                      enabled:
                        event.target
                          .checked,
                    })
                  }
                  className="size-3.5"
                />

                <Sparkles className="size-3.5" />

                Available to AI

              </label>

              <Button
                variant="ghost"
                size="icon"
                onClick={
                  deleteNote
                }
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2 className="size-4" />
              </Button>

            </header>


            {/* ================================================== */}
            {/* Type Information */}
            {/* ================================================== */}

            <div className="flex items-start gap-2 border-b bg-muted/20 px-6 py-3">

              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />

              <div className="min-w-0">

                <div className="text-xs font-medium">

                  {
                    STORY_NOTE_TYPES.find(
                      (
                        item,
                      ) =>
                        item.type ===
                        selectedNote.type,
                    )?.label
                  }

                </div>

                <div className="mt-0.5 text-xs leading-5 text-muted-foreground">

                  {
                    STORY_NOTE_TYPES.find(
                      (
                        item,
                      ) =>
                        item.type ===
                        selectedNote.type,
                    )?.description
                  }

                </div>

              </div>

            </div>


            {/* ================================================== */}
            {/* Content */}
            {/* ================================================== */}

            <div className="min-h-0 flex-1 p-6">

              <Textarea
                value={
                  selectedNote.content
                }
                onChange={(
                  event,
                ) =>
                  updateNote({
                    content:
                      event.target
                        .value,
                  })
                }
                placeholder={
                  getPlaceholder(
                    selectedNote.type,
                  )
                }
                className="h-full min-h-[400px] resize-none"
              />

            </div>


            {/* ================================================== */}
            {/* Footer */}
            {/* ================================================== */}

            <footer className="flex shrink-0 items-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">

              <Save className="size-3.5" />

              <span>
                Automatically saved with your project.
              </span>

              <span className="ml-auto">

                {selectedNote.enabled
                  ? "AI enabled"
                  : "AI disabled"}

              </span>

            </footer>

          </>

        )}

      </section>

    </div>
  )
}


/*
 * --------------------------------------------------
 * Note-specific placeholders
 * --------------------------------------------------
 */

function getPlaceholder(
  type: StoryNoteType,
): string {
  switch (type) {

    case "authors-note":
      return "Tell the AI something important about how you want the story written...\n\nExample:\nDo not reveal that Alaric knows about the betrayal yet. Keep his knowledge ambiguous."

    case "plot-essentials":
      return "Record facts that are essential to the plot and must remain consistent...\n\nExample:\nThe king secretly caused the war ten years ago."

    case "plot-summary":
      return "Describe the broad overall plot and where the story is intended to go.\n\nRemember: this is a long-term story roadmap, not a list of events that must happen immediately."

    case "story-direction":
      return "Describe the general direction you want the story to move toward...\n\nExample:\nThe relationship should gradually become more trusting while political tensions increase."

    case "tone-style":
      return "Describe persistent tone, prose style, atmosphere, themes, or stylistic preferences...\n\nExample:\nKeep the prose intimate, atmospheric, and restrained. Avoid melodramatic dialogue."

    case "character-arcs":
      return "Describe long-term character development...\n\nExample:\nElara should gradually become more willing to trust others, but her fear of betrayal should remain a recurring obstacle."

    case "open-threads":
      return "Record mysteries, unresolved conflicts, promises, clues, and future payoffs...\n\nExample:\nWho sent the letter found in the ruined chapel?"

    case "world-rules":
      return "Record rules and constraints of the world that should remain consistent...\n\nExample:\nMagic cannot create life or resurrect the dead."

    default:
      return "Write a persistent note for the AI..."
  }
}
