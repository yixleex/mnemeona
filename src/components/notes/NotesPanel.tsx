import { useMemo, useState } from "react"
import { Plus, Save, StickyNote, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"
import {
  STORY_NOTE_TYPES,
  type StoryNote,
  type StoryNoteType,
} from "@/types/notes"

function createNote(type: StoryNoteType): StoryNote {
  const now = new Date().toISOString()
  const definition = STORY_NOTE_TYPES.find((item) => item.type === type)!

  return {
    id: crypto.randomUUID(),
    type,
    title: definition.label,
    content: "",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }
}

export function NotesPanel() {
  const { project, updateProject } = useProject()

  const notes = project.notes as StoryNote[]

  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  )

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? notes[0] ?? null,
    [notes, selectedId],
  )

  const updateNote = (updates: Partial<StoryNote>) => {
    if (!selectedNote) return

    updateProject((current) => ({
      ...current,
      notes: (current.notes as StoryNote[]).map((note) =>
        note.id === selectedNote.id
          ? {
              ...note,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  const addNote = (type: StoryNoteType = "authors-note") => {
    const note = createNote(type)

    updateProject((current) => ({
      ...current,
      notes: [...(current.notes as StoryNote[]), note],
      updatedAt: new Date().toISOString(),
    }))

    setSelectedId(note.id)
  }

  const deleteNote = () => {
    if (!selectedNote) return

    const remaining = notes.filter((note) => note.id !== selectedNote.id)

    updateProject((current) => ({
      ...current,
      notes: remaining,
      updatedAt: new Date().toISOString(),
    }))

    setSelectedId(remaining[0]?.id ?? null)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <StickyNote className="size-4" />
            <span className="font-medium">Notes</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => addNote()}
            title="New note"
          >
            <Plus className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {notes.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No notes yet. Create an Author's Note, Plot Summary, or another
              persistent story note.
            </div>
          ) : (
            <div className="space-y-1">
              {notes.map((note) => {
                const definition = STORY_NOTE_TYPES.find(
                  (item) => item.type === note.type,
                )

                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selectedNote?.id === note.id
                        ? "bg-secondary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="truncate text-sm font-medium">
                      {note.title || definition?.label || "Note"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {definition?.label}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {!selectedNote ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a note or create one.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b px-6 py-4">
              <Input
                value={selectedNote.title}
                onChange={(event) => updateNote({ title: event.target.value })}
                className="max-w-xl text-base font-medium"
              />

              <select
                value={selectedNote.type}
                onChange={(event) =>
                  updateNote({
                    type: event.target.value as StoryNoteType,
                  })
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                {STORY_NOTE_TYPES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.label}
                  </option>
                ))}
              </select>

              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selectedNote.enabled}
                  onChange={(event) =>
                    updateNote({ enabled: event.target.checked })
                  }
                />
                Available to AI
              </label>

              <Button
                variant="ghost"
                size="icon"
                onClick={deleteNote}
                title="Delete note"
              >
                <Trash2 className="size-4" />
              </Button>
            </header>

            <div className="border-b bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
              {
                STORY_NOTE_TYPES.find(
                  (item) => item.type === selectedNote.type,
                )?.description
              }
            </div>

            <div className="min-h-0 flex-1 p-6">
              <Textarea
                value={selectedNote.content}
                onChange={(event) =>
                  updateNote({ content: event.target.value })
                }
                placeholder="Write the note here..."
                className="h-full min-h-[400px] resize-none"
              />
            </div>

            <footer className="flex items-center gap-2 border-t px-6 py-3 text-xs text-muted-foreground">
              <Save className="size-3.5" />
              Notes are automatically saved with the project.
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
