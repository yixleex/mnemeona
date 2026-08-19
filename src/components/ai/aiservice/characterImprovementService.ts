import {
  buildAIContext,
  loadAIConfig,
  validateAIConfig,
  type AIMessage,
} from "./aiService"

import type { MnemeonaProject } from "@/types/project"
import type { Character } from "@/types/character"

// --------------------------------------------------
// Character Improvement Token Settings
// --------------------------------------------------

const CHARACTER_IMPROVEMENT_TOKENS_KEY =
  "mnemeona-ai-character-improvement-tokens"

const DEFAULT_CHARACTER_IMPROVEMENT_TOKENS =
  4096

const MIN_CHARACTER_IMPROVEMENT_TOKENS =
  1024

const MAX_CHARACTER_IMPROVEMENT_TOKENS =
  8192

const CHARACTER_IMPROVEMENT_TOKEN_STEP =
  256

export function normalizeCharacterImprovementTokens(
  tokens: number,
): number {
  if (!Number.isFinite(tokens)) {
    return DEFAULT_CHARACTER_IMPROVEMENT_TOKENS
  }

  return Math.min(
    MAX_CHARACTER_IMPROVEMENT_TOKENS,
    Math.max(
      MIN_CHARACTER_IMPROVEMENT_TOKENS,
      Math.round(
        tokens /
          CHARACTER_IMPROVEMENT_TOKEN_STEP,
      ) *
        CHARACTER_IMPROVEMENT_TOKEN_STEP,
    ),
  )
}

export function loadCharacterImprovementTokens(): number {
  try {
    const stored =
      localStorage.getItem(
        CHARACTER_IMPROVEMENT_TOKENS_KEY,
      )

    if (!stored) {
      return DEFAULT_CHARACTER_IMPROVEMENT_TOKENS
    }

    const parsed =
      Number(stored)

    if (!Number.isFinite(parsed)) {
      return DEFAULT_CHARACTER_IMPROVEMENT_TOKENS
    }

    return normalizeCharacterImprovementTokens(
      parsed,
    )
  } catch {
    return DEFAULT_CHARACTER_IMPROVEMENT_TOKENS
  }
}

export function saveCharacterImprovementTokens(
  tokens: number,
): void {
  const normalized =
    normalizeCharacterImprovementTokens(
      tokens,
    )

  localStorage.setItem(
    CHARACTER_IMPROVEMENT_TOKENS_KEY,
    String(normalized),
  )
}

// --------------------------------------------------
// Types
// --------------------------------------------------

export interface CharacterDraft {
  name: string
  aliases: string[]
  role: string
  summary: string
  personality: string
  appearance: string
  background: string
  age: string
  goals: string
  fears: string
  motivations: string
  notes: string
}

export type CharacterDraftField =
  keyof CharacterDraft

export type CharacterChanges =
  Partial<CharacterDraft>

export interface CharacterRevision {
  changes: CharacterChanges
  message: string
}

type ProjectScene =
  MnemeonaProject[
    "manuscript"
  ]["acts"][number]["chapters"][number]["scenes"][number]

export interface CharacterImprovementOptions {
  character: Character
  draft: CharacterDraft
  request: string
  project: MnemeonaProject
  activeScene: ProjectScene
  previousMessages?: AIMessage[]
  signal?: AbortSignal
  maxTokens?: number
}

// --------------------------------------------------
// Fields
// --------------------------------------------------

const CHARACTER_FIELDS: CharacterDraftField[] = [
  "name",
  "aliases",
  "role",
  "summary",
  "personality",
  "appearance",
  "background",
  "age",
  "goals",
  "fears",
  "motivations",
  "notes",
]

// --------------------------------------------------
// Placeholder / Truncation Detection
// --------------------------------------------------

const PLACEHOLDER_VALUES = new Set([
  "...",
  "…",
  "[...]",
  "[…]",
  "[continue]",
  "[continued]",
  "[truncated]",
  "[cut off]",
  "same as before",
  "unchanged",
  "no change",
  "n/a",
])

function isPlaceholderValue(
  value: string,
): boolean {
  const normalized =
    value
      .trim()
      .toLowerCase()

  if (!normalized) {
    return true
  }

  if (
    PLACEHOLDER_VALUES.has(
      normalized,
    )
  ) {
    return true
  }

  if (
    normalized.length <= 8 &&
    /^[.…\s]+$/.test(
      normalized,
    )
  ) {
    return true
  }

  return false
}

function looksTruncated(
  value: string,
): boolean {
  const trimmed =
    value.trim()

  if (!trimmed) {
    return true
  }

  if (
    trimmed === "..." ||
    trimmed === "…"
  ) {
    return true
  }

  if (
    trimmed.endsWith("...") ||
    trimmed.endsWith("…")
  ) {
    return true
  }

  if (
    /\[(?:continue|continued|truncated|cut off)\]/i.test(
      trimmed,
    )
  ) {
    return true
  }

  return false
}

// --------------------------------------------------
// Request Detection
// --------------------------------------------------

const EXPANSION_WORDS = [
  "expand",
  "expanded",
  "expand on",
  "elaborate",
  "elaborate on",
  "develop",
  "develop further",
  "flesh out",
  "flesh",
  "deepen",
  "deepen the",
  "more detail",
  "add detail",
  "add more",
  "make longer",
  "make it longer",
  "make this longer",
  "add depth",
  "give more detail",
]

function isExpansionRequest(
  request: string,
): boolean {
  const text =
    request
      .toLowerCase()
      .trim()

  return EXPANSION_WORDS.some(
    (word) =>
      text.includes(word),
  )
}

function detectRequestedFields(
  request: string,
): CharacterDraftField[] {
  const text =
    request
      .toLowerCase()
      .trim()

  const fields: CharacterDraftField[] =
    []

  const mappings: Array<{
    field: CharacterDraftField
    words: string[]
  }> = [
    {
      field: "background",
      words: [
        "background",
        "history",
        "past",
        "backstory",
        "back story",
        "childhood",
        "upbringing",
        "origins",
        "origin",
      ],
    },

    {
      field: "personality",
      words: [
        "personality",
        "temperament",
        "demeanor",
        "behaviour",
        "behavior",
      ],
    },

    {
      field: "appearance",
      words: [
        "appearance",
        "look",
        "looks",
        "physical",
        "face",
        "body",
        "clothing",
      ],
    },

    {
      field: "goals",
      words: [
        "goal",
        "goals",
        "objective",
        "objectives",
        "ambition",
        "ambitions",
      ],
    },

    {
      field: "fears",
      words: [
        "fear",
        "fears",
        "afraid",
        "phobia",
        "phobias",
      ],
    },

    {
      field: "motivations",
      words: [
        "motivation",
        "motivations",
        "motivated",
        "reason",
        "reasons",
        "drive",
      ],
    },

    {
      field: "summary",
      words: [
        "summary",
        "overview",
        "description",
      ],
    },

    {
      field: "role",
      words: [
        "role",
        "position",
        "occupation",
        "job",
        "profession",
      ],
    },

    {
      field: "age",
      words: [
        "age",
        "years old",
        "older",
        "younger",
      ],
    },

    {
      field: "aliases",
      words: [
        "alias",
        "aliases",
        "nickname",
        "nicknames",
      ],
    },

    {
      field: "notes",
      words: [
        "notes",
        "note",
      ],
    },

    {
      field: "name",
      words: [
        "name",
        "rename",
        "renamed",
      ],
    },
  ]

  for (
    const mapping of mappings
  ) {
    if (
      mapping.words.some(
        (word) =>
          text.includes(word),
      )
    ) {
      fields.push(
        mapping.field,
      )
    }
  }

  return fields
}

// --------------------------------------------------
// Draft Serialization
// --------------------------------------------------

function characterToSerializableDraft(
  draft: CharacterDraft,
): CharacterDraft {
  return {
    name: draft.name,
    aliases: [
      ...draft.aliases,
    ],
    role: draft.role,
    summary: draft.summary,
    personality: draft.personality,
    appearance: draft.appearance,
    background: draft.background,
    age: draft.age,
    goals: draft.goals,
    fears: draft.fears,
    motivations: draft.motivations,
    notes: draft.notes,
  }
}

// --------------------------------------------------
// Expansion Prompt
// --------------------------------------------------

function buildExpansionPrompt(
  character: Character,
  draft: CharacterDraft,
  field: CharacterDraftField,
  request: string,
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  /*
   * IMPORTANT:
   *
   * Do NOT send the entire normal AI context here.
   *
   * Character expansion works much better when the model has
   * a focused task instead of being buried under the manuscript.
   */

  const existingValue =
    field === "aliases"
      ? draft.aliases.join(", ")
      : String(
          draft[field] ?? "",
        )

  const characterIdentity =
    [
      `Name: ${draft.name}`,
      `Aliases: ${draft.aliases.join(", ")}`,
      `Role: ${draft.role}`,
      `Age: ${draft.age}`,
      `Summary: ${draft.summary}`,
      `Personality: ${draft.personality}`,
      `Appearance: ${draft.appearance}`,
      `Goals: ${draft.goals}`,
      `Fears: ${draft.fears}`,
      `Motivations: ${draft.motivations}`,
    ].join("\n")

  /*
   * We only include a small amount of story context.
   * The character profile itself is more important for this task.
   */

  let storyContext = ""

  try {
    const fullContext =
      buildAIContext(
        project,
        activeScene,
      )

    /*
     * Keep context bounded so a local model doesn't spend
     * its context window reading the manuscript instead of
     * doing the requested expansion.
     */
    storyContext =
      fullContext.length > 12000
        ? fullContext.slice(
            0,
            12000,
          )
        : fullContext
  } catch {
    storyContext = ""
  }

  return `You are a character development editor.

Your ONLY task is to expand ONE EXISTING CHARACTER FIELD.

Do not answer conversationally.
Do not explain what you would write.
Do not return JSON.
Do not return markdown.
Do not return a heading.
Return ONLY the complete revised field text.

CHARACTER:
${characterIdentity}

FIELD TO EXPAND:
${field}

CURRENT FIELD:
${existingValue || "(The field is currently empty.)"}

AUTHOR REQUEST:
${request}

RULES:

1. Preserve everything already established in the current field.
2. Add meaningful, concrete detail.
3. The result must be the ACTUAL COMPLETE FIELD TEXT.
4. Do not use placeholders.
5. Never output "...".
6. Never output "…".
7. Never output "[continue]".
8. Never output "[continued]".
9. Never say "the rest remains unchanged".
10. Never describe what could be added.
11. Actually write the expanded field.
12. Do not invent facts that contradict the character profile or story context.
13. You may creatively develop unspecified details when the author explicitly asks for expansion.
14. The result should normally be substantially longer than the current field.
15. Return several complete sentences or paragraphs when appropriate.
16. Do not prefix the answer with "${field}:".
17. Do not wrap the answer in quotation marks.
18. Do not use markdown formatting.

The author asked you to expand the field.

WRITE THE COMPLETE EXPANDED FIELD NOW.

STORY CONTEXT:
${storyContext || "(No additional story context is available.)"}
`
}

// --------------------------------------------------
// General Revision Prompt
// --------------------------------------------------

function buildGeneralRevisionPrompt(
  character: Character,
  draft: CharacterDraft,
  request: string,
  project: MnemeonaProject,
  activeScene: ProjectScene,
): string {
  const context =
    buildAIContext(
      project,
      activeScene,
    )

  const requestedFields =
    detectRequestedFields(
      request,
    )

  const requestedFieldText =
    requestedFields.length > 0
      ? requestedFields.join(
          ", ",
        )
      : "Determine the affected fields from the request."

  return `You are Mnemeona's dedicated CHARACTER REVISION ENGINE.

You modify an existing character profile.

Return exactly one valid JSON object and nothing else.

FORMAT:

{
  "changes": {
    "fieldName": "complete replacement value"
  },
  "message": "Short explanation."
}

RULES:

- "changes" is a PATCH.
- Only include fields that actually need changing.
- Never return the entire character unless explicitly requested.
- Preserve established facts.
- Do not change relationships.
- If a field changes, return the COMPLETE replacement value.
- Never use "...".
- Never use "…".
- Never use "[continue]".
- Never use "[continued]".
- Never use "same as before".
- Never use "unchanged".
- Never truncate a changed field.
- Never describe a change instead of writing the changed value.

REQUESTED FIELDS:
${requestedFieldText}

AUTHOR REQUEST:
${request}

CHARACTER:
${JSON.stringify(
  {
    id: character.id,
    name: character.name,
    aliases: character.aliases,
    role: character.role,
    summary: character.summary,
    personality: character.personality,
    appearance: character.appearance,
    background: character.background,
    age: character.age,
    goals: character.goals,
    fears: character.fears,
    motivations: character.motivations,
    notes: character.notes,
  },
  null,
  2,
)}

CURRENT WORKING PROFILE:
${JSON.stringify(
  characterToSerializableDraft(
    draft,
  ),
  null,
  2,
)}

STORY CONTEXT:
${context}

CURRENT SCENE:
Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}

Return ONLY valid JSON.`
}

// --------------------------------------------------
// Ollama Request
// --------------------------------------------------

async function requestCharacterAI(
  messages: AIMessage[],
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<string> {
  const config =
    loadAIConfig()

  validateAIConfig(config)

  if (signal?.aborted) {
    throw createAbortError()
  }

  const endpoint =
    config.endpoint.replace(
      /\/+$/,
      "",
    )

  const tokens =
    normalizeCharacterImprovementTokens(
      maxTokens ??
        loadCharacterImprovementTokens(),
    )

  let response: Response

  try {
    response =
      await fetch(
        `${endpoint}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(config.apiKey
              ? {
                  Authorization:
                    `Bearer ${config.apiKey}`,
                }
              : {}),
          },

          body: JSON.stringify({
            model: config.model,

            messages,

            options: {
              num_predict: tokens,

              /*
               * Low temperature is important for the
               * structured/general path.
               *
               * Expansion itself benefits from a little
               * creativity, but still needs to follow
               * instructions.
               */
              temperature: 0.4,
            },

            stream: false,
          }),

          signal,
        },
      )
  } catch (error) {
    if (
      isAbortError(error) ||
      signal?.aborted
    ) {
      throw createAbortError()
    }

    throw new Error(
      `Unable to connect to the AI server at ${endpoint}. Make sure Ollama is running and the server is reachable.`,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    let details = ""

    try {
      const text =
        await response.text()

      if (text.trim()) {
        try {
          const parsed =
            JSON.parse(text)

          details =
            parsed?.error
              ? String(
                  parsed.error,
                )
              : text
        } catch {
          details = text
        }
      }
    } catch {
      // Ignore response parsing errors.
    }

    throw new Error(
      details
        ? `AI server returned ${response.status}: ${details}`
        : `AI server returned HTTP ${response.status}.`,
    )
  }

  let data: any

  try {
    data =
      await response.json()
  } catch (error) {
    throw new Error(
      "AI server returned invalid JSON.",
      {
        cause: error,
      },
    )
  }

  if (data?.error) {
    throw new Error(
      String(data.error),
    )
  }

  const content =
    data?.message?.content

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "The character improvement AI returned an empty response.",
    )
  }

  return content.trim()
}

// --------------------------------------------------
// Dedicated Expansion
// --------------------------------------------------

async function expandCharacterField(
  character: Character,
  draft: CharacterDraft,
  field: CharacterDraftField,
  request: string,
  project: MnemeonaProject,
  activeScene: ProjectScene,
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<string> {
  const prompt =
    buildExpansionPrompt(
      character,
      draft,
      field,
      request,
      project,
      activeScene,
    )

  const response =
    await requestCharacterAI(
      [
        {
          role: "system",
          content:
            "You are a professional character-development editor. When asked to expand a field, write the complete expanded field text. Never use placeholders.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      signal,
      maxTokens,
    )

  let result =
    cleanPlainTextResponse(
      response,
    )

  /*
   * Some models still try to be clever and respond with
   * things like:
   *
   * "Here is the expanded background:"
   *
   * Strip that common wrapper.
   */
  result =
    stripExpansionWrapper(
      result,
      field,
    )

  if (
    !isUsableExpansion(
      result,
    )
  ) {
    /*
     * Retry ONCE with an extremely small, explicit prompt.
     *
     * This is specifically to defeat models that answer
     * "..." despite the first prompt.
     */
    const retryPrompt = `Rewrite the character's ${field}.

CURRENT ${field.toUpperCase()}:
${
  field === "aliases"
    ? draft.aliases.join(", ")
    : String(
        draft[field] ?? "",
      )
}

AUTHOR REQUEST:
${request}

Return ONLY the actual rewritten ${field}.

The result MUST contain real prose.

NEVER return:
...
…
[continue]
[continued]
unchanged
same as before

Preserve the existing information and make it substantially more detailed.

WRITE THE COMPLETE TEXT NOW.`

    const retry =
      await requestCharacterAI(
        [
          {
            role: "system",
            content:
              "Return actual prose only. Never return a placeholder.",
          },
          {
            role: "user",
            content:
              retryPrompt,
          },
        ],
        signal,
        maxTokens,
      )

    result =
      stripExpansionWrapper(
        cleanPlainTextResponse(
          retry,
        ),
        field,
      )
  }

  if (
    !isUsableExpansion(
      result,
    )
  ) {
    throw new Error(
      `The AI failed to produce usable expanded content for "${field}". No changes were applied.`,
    )
  }

  /*
   * If there was already substantial content, make sure
   * the model actually expanded it instead of merely
   * rephrasing it into something shorter.
   */
  const oldValue =
    field === "aliases"
      ? draft.aliases.join(", ")
      : String(
          draft[field] ?? "",
        )

  if (
    oldValue.trim().length >= 80 &&
    result.trim().length <
      oldValue.trim().length * 0.75
  ) {
    throw new Error(
      `The AI returned a shorter version of "${field}" instead of expanding it. No changes were applied.`,
    )
  }

  return result.trim()
}

// --------------------------------------------------
// Plain Text Cleaning
// --------------------------------------------------

function cleanPlainTextResponse(
  value: string,
): string {
  let text =
    value.trim()

  text =
    text.replace(
      /^```(?:text|markdown)?\s*/i,
      "",
    )

  text =
    text.replace(
      /\s*```$/i,
      "",
    )

  /*
   * If a model accidentally returns a JSON object
   * containing a single "content"/"text" value, recover
   * it instead of feeding JSON to the character field.
   */
  if (
    text.startsWith("{") &&
    text.endsWith("}")
  ) {
    try {
      const parsed =
        JSON.parse(text)

      if (
        typeof parsed?.content ===
        "string"
      ) {
        return parsed.content.trim()
      }

      if (
        typeof parsed?.text ===
        "string"
      ) {
        return parsed.text.trim()
      }
    } catch {
      // Not JSON; continue normally.
    }
  }

  return text.trim()
}

function stripExpansionWrapper(
  value: string,
  field: CharacterDraftField,
): string {
  let text =
    value.trim()

  const fieldName =
    field.charAt(0).toUpperCase() +
    field.slice(1)

  const patterns = [
    new RegExp(
      `^${fieldName}\\s*:\\s*`,
      "i",
    ),

    new RegExp(
      `^${field}\\s*:\\s*`,
      "i",
    ),

    /^Here(?:'s| is) the (?:expanded|revised).*?:\s*/i,

    /^Here(?:'s| is) the requested.*?:\s*/i,

    /^Expanded (?:background|field):\s*/i,
  ]

  for (
    const pattern of patterns
  ) {
    text =
      text.replace(
        pattern,
        "",
      )
  }

  /*
   * Remove surrounding quotation marks if the model
   * wrapped the whole answer in them.
   */
  if (
    text.length >= 2 &&
    (
      (
        text.startsWith('"') &&
        text.endsWith('"')
      ) ||
      (
        text.startsWith("'") &&
        text.endsWith("'")
      )
    )
  ) {
    text =
      text.slice(
        1,
        -1,
      )
  }

  return text.trim()
}

function isUsableExpansion(
  value: string,
): boolean {
  const text =
    value.trim()

  if (!text) {
    return false
  }

  if (
    isPlaceholderValue(
      text,
    )
  ) {
    return false
  }

  if (
    looksTruncated(
      text,
    )
  ) {
    return false
  }

  /*
   * A one-word answer is never a useful expansion.
   */
  if (
    text.length < 20
  ) {
    return false
  }

  return true
}

// --------------------------------------------------
// JSON Revision Parsing
// --------------------------------------------------

function normalizeFieldValue(
  field: CharacterDraftField,
  value: unknown,
): string | string[] | undefined {
  if (
    field === "aliases"
  ) {
    if (
      !Array.isArray(value)
    ) {
      return undefined
    }

    return value
      .map((item) =>
        String(item).trim(),
      )
      .filter(Boolean)
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return undefined
  }

  return String(value)
}

function cleanJsonResponse(
  value: string,
): string {
  let text =
    value.trim()

  text =
    text.replace(
      /^```(?:json)?\s*/i,
      "",
    )

  text =
    text.replace(
      /\s*```$/i,
      "",
    )

  const firstBrace =
    text.indexOf("{")

  const lastBrace =
    text.lastIndexOf("}")

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    text =
      text.slice(
        firstBrace,
        lastBrace + 1,
      )
  }

  return text.trim()
}

function parseRevision(
  value: string,
): CharacterRevision {
  const cleaned =
    cleanJsonResponse(
      value,
    )

  if (!cleaned) {
    throw new Error(
      "The character improvement AI returned an empty response.",
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(cleaned)
  } catch (error) {
    throw new Error(
      "The character improvement AI returned incomplete or invalid JSON. No changes were applied.",
      {
        cause: error,
      },
    )
  }

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "The character improvement AI returned an invalid revision object.",
    )
  }

  const source =
    parsed as Record<
      string,
      unknown
    >

  let rawChanges =
    source.changes

  if (
    (!rawChanges ||
      typeof rawChanges !== "object") &&
    source.character &&
    typeof source.character ===
      "object"
  ) {
    rawChanges =
      source.character
  }

  if (
    !rawChanges ||
    typeof rawChanges !== "object"
  ) {
    throw new Error(
      "The AI returned a response without a valid changes object.",
    )
  }

  const raw =
    rawChanges as Record<
      string,
      unknown
    >

  const changes: CharacterChanges =
    {}

  for (
    const field of CHARACTER_FIELDS
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        raw,
        field,
      )
    ) {
      continue
    }

    const normalized =
      normalizeFieldValue(
        field,
        raw[field],
      )

    if (
      normalized === undefined
    ) {
      continue
    }

    if (
      typeof normalized ===
      "string"
    ) {
      if (
        !isUsableExpansion(
          normalized,
        )
      ) {
        throw new Error(
          `The AI returned invalid or placeholder content for "${field}". No changes were applied.`,
        )
      }

      changes[field] =
        normalized
    } else {
      changes[field] =
        normalized
    }
  }

  const message =
    typeof source.message ===
    "string"
      ? source.message.trim()
      : ""

  return {
    changes,
    message:
      message ||
      (
        Object.keys(
          changes,
        ).length > 0
          ? "I prepared the requested character revision."
          : "I did not find a character field that needed to change."
      ),
  }
}

// --------------------------------------------------
// General Revision
// --------------------------------------------------

async function performGeneralRevision(
  character: Character,
  draft: CharacterDraft,
  request: string,
  project: MnemeonaProject,
  activeScene: ProjectScene,
  previousMessages: AIMessage[],
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<CharacterRevision> {
  const systemPrompt =
    buildGeneralRevisionPrompt(
      character,
      draft,
      request,
      project,
      activeScene,
    )

  const messages: AIMessage[] =
    [
      ...previousMessages,
      {
        role: "user",
        content: request,
      },
    ]

  const response =
    await requestCharacterAI(
      [
        {
          role: "system",
          content:
            systemPrompt,
        },
        ...messages,
      ],
      signal,
      maxTokens,
    )

  return parseRevision(
    response,
  )
}

// --------------------------------------------------
// Main Public API
// --------------------------------------------------

export async function improveCharacter(
  options: CharacterImprovementOptions,
): Promise<CharacterRevision> {
  const {
    character,
    draft,
    request,
    project,
    activeScene,
    previousMessages = [],
    signal,
    maxTokens,
  } = options

  const trimmedRequest =
    request.trim()

  if (!trimmedRequest) {
    throw new Error(
      "Please enter a character improvement request.",
    )
  }

  if (signal?.aborted) {
    throw createAbortError()
  }

  const requestedFields =
    detectRequestedFields(
      trimmedRequest,
    )

  const expansion =
    isExpansionRequest(
      trimmedRequest,
    )

  /*
   * ------------------------------------------------
   * THE IMPORTANT FIX
   * ------------------------------------------------
   *
   * Requests such as:
   *
   * "expand her background"
   *
   * now bypass the JSON revision engine entirely.
   *
   * We directly ask the model for the complete text
   * of the background field.
   */
  if (
    expansion &&
    requestedFields.length > 0
  ) {
    /*
     * Prefer the most obvious field.
     *
     * Background is intentionally first for requests
     * such as "expand her background".
     */
    const field =
      requestedFields.includes(
        "background",
      )
        ? "background"
        : requestedFields[0]

    const expanded =
      await expandCharacterField(
        character,
        draft,
        field,
        trimmedRequest,
        project,
        activeScene,
        signal,
        maxTokens,
      )

    return {
      changes: {
        [field]:
          expanded,
      },

      message:
        `Expanded ${field}.`,
    }
  }

  /*
   * Normal non-expansion revisions continue to use
   * the JSON patch system.
   */
  return performGeneralRevision(
    character,
    draft,
    trimmedRequest,
    project,
    activeScene,
    previousMessages,
    signal,
    maxTokens,
  )
}
