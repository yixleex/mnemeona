export type StoryNoteType =
  | "authors-note"
  | "plot-essentials"
  | "plot-summary"
  | "story-direction"
  | "tone-style"
  | "character-arcs"
  | "open-threads"
  | "world-rules"

export interface StoryNote {
  id: string
  type: StoryNoteType
  title: string
  content: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export const STORY_NOTE_TYPES: Array<{
  type: StoryNoteType
  label: string
  description: string
  aiInstruction: string
}> = [
  {
    type: "authors-note",
    label: "Author's Note",
    description: "Direct instructions and important things the AI should remember while writing.",
    aiInstruction: "Treat this as a direct instruction from the author. Follow it when generating or continuing the story unless it conflicts with higher-priority system constraints.",
  },
  {
    type: "plot-essentials",
    label: "Plot Essentials",
    description: "Hard canon and essential plot facts that must remain consistent.",
    aiInstruction: "Treat these as essential plot canon. Do not contradict, ignore, or casually alter these facts.",
  },
  {
    type: "plot-summary",
    label: "Plot Summary",
    description: "The broad overall plot and intended direction of the novel.",
    aiInstruction: "This describes the broad story arc, not a scene-by-scene schedule. Do not rush through or resolve the entire described plot in only a few scenes. Use it as long-term direction and reveal developments at an appropriate narrative pace.",
  },
  {
    type: "story-direction",
    label: "Story Direction",
    description: "Where the story should generally head next.",
    aiInstruction: "Use this as guidance for the story's long-term direction without forcing every listed development immediately.",
  },
  {
    type: "tone-style",
    label: "Tone & Style",
    description: "Persistent prose, tone, atmosphere, themes, and stylistic preferences.",
    aiInstruction: "Maintain these tonal and stylistic preferences consistently in generated prose.",
  },
  {
    type: "character-arcs",
    label: "Character Arcs",
    description: "Long-term character development and emotional trajectories.",
    aiInstruction: "Use these as long-term character-development guidance. Do not complete an arc prematurely unless the story has earned it.",
  },
  {
    type: "open-threads",
    label: "Open Threads",
    description: "Mysteries, unresolved conflicts, promises, and future payoffs.",
    aiInstruction: "Keep these unresolved threads in mind and preserve their continuity. Do not resolve them prematurely unless the story calls for it.",
  },
  {
    type: "world-rules",
    label: "World Rules",
    description: "Persistent rules, limitations, lore, and setting constraints.",
    aiInstruction: "Treat these as persistent world rules and avoid contradicting them.",
  },
]
