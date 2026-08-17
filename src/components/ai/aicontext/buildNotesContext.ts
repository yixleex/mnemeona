import type { MnemeonaProject } from "@/types/project"

import {
  STORY_NOTE_TYPES,
  type StoryNote,
} from "@/types/notes"

/**
 * Builds the persistent story-notes context that is supplied
 * to the AI.
 *
 * Notes are intentionally categorized so the AI understands
 * what each note means instead of treating every note as
 * generic text.
 *
 * Important distinction:
 *
 * - Author's Note = direct author instruction
 * - Plot Essentials = hard canon
 * - Plot Summary = broad long-term story direction
 * - Story Direction = general trajectory
 * - Tone & Style = persistent writing preferences
 * - Character Arcs = long-term character development
 * - Open Threads = unresolved story elements
 * - World Rules = persistent setting rules
 */
export function buildNotesContext(
  project: MnemeonaProject,
): string {
  const notes = normalizeStoryNotes(
    project.notes,
  )

  const enabledNotes =
    notes.filter(
      (note) =>
        note.enabled &&
        note.content.trim(),
    )

  if (
    enabledNotes.length === 0
  ) {
    return ""
  }

  const sections: string[] = []

  sections.push(
    [
      "## Persistent Story Notes",
      "",
      "The following notes are persistent author guidance for the story.",
      "",
      "They remain relevant across scenes unless the author explicitly changes or removes them.",
      "",
      "Use the semantic meaning of each note type when interpreting the notes.",
    ].join("\n"),
  )

  /*
   * Keep notes in a deliberate priority order.
   *
   * Hard canon and direct author instructions should appear
   * before broader planning information.
   */
  const orderedTypes = [
    "authors-note",
    "plot-essentials",
    "world-rules",
    "character-arcs",
    "open-threads",
    "plot-summary",
    "story-direction",
    "tone-style",
  ] as const

  for (
    const type of orderedTypes
  ) {
    const typeNotes =
      enabledNotes.filter(
        (note) =>
          note.type === type,
      )

    if (
      typeNotes.length === 0
    ) {
      continue
    }

    const definition =
      STORY_NOTE_TYPES.find(
        (item) =>
          item.type === type,
      )

    const noteSections =
      typeNotes.map(
        (note) =>
          formatNote(
            note,
            definition?.label ??
              type,
            definition?.aiInstruction ??
              "",
          ),
      )

    sections.push(
      [
        `### ${definition?.label ?? type}`,
        "",
        noteSections.join(
          "\n\n",
        ),
      ].join("\n"),
    )
  }

  /*
   * Gracefully handle future note types that may be added
   * without being included in the ordering list above.
   */
  const knownTypes =
    new Set<string>(
      orderedTypes,
    )

  const additionalNotes =
    enabledNotes.filter(
      (note) =>
        !knownTypes.has(
          note.type,
        ),
    )

  if (
    additionalNotes.length > 0
  ) {
    sections.push(
      [
        "### Other Persistent Notes",
        "",
        additionalNotes
          .map((note) =>
            formatNote(
              note,
              note.type,
              "",
            ),
          )
          .join("\n\n"),
      ].join("\n"),
    )
  }

  return sections.join(
    "\n\n",
  )
}

/**
 * Formats one individual note.
 */
function formatNote(
  note: StoryNote,
  label: string,
  instruction: string,
): string {
  const parts: string[] = []

  parts.push(
    `#### ${note.title || label}`,
  )

  if (
    instruction.trim()
  ) {
    parts.push(
      `AI interpretation: ${instruction.trim()}`,
    )
  }

  parts.push(
    note.content.trim(),
  )

  return parts.join(
    "\n",
  )
}

/**
 * Projects created before structured StoryNote support may
 * contain an empty notes array or legacy note objects.
 *
 * This normalizer keeps the AI context builder defensive.
 */
function normalizeStoryNotes(
  notes: unknown,
): StoryNote[] {
  if (
    !Array.isArray(notes)
  ) {
    return []
  }

  return notes.filter(
    isStoryNote,
  )
}

/**
 * Runtime validation for persisted notes.
 */
function isStoryNote(
  value: unknown,
): value is StoryNote {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false
  }

  const note =
    value as Partial<StoryNote>

  return (
    typeof note.id ===
      "string" &&
    typeof note.type ===
      "string" &&
    typeof note.title ===
      "string" &&
    typeof note.content ===
      "string" &&
    typeof note.enabled ===
      "boolean"
  )
}
