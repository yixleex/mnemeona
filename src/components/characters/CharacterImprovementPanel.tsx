import {
  Bot,
  Check,
  RefreshCw,
  Send,
  Square,
  User,
  X,
} from "lucide-react"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"

import { useProject } from "@/context/ProjectContext"

import {
  loadCharacterImprovementTokens,
  saveCharacterImprovementTokens,
  normalizeCharacterImprovementTokens,
  type CharacterDraft,
  type CharacterDraftField,
} from "@/components/ai/aiservice/characterImprovementService"

import {
  improveCharacter,
} from "@/components/ai/aiservice/characterImprovementService"

import type { Character } from "@/types/character"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface CharacterImprovementPanelProps {
  character: Character
  onClose: () => void
}

const MIN_TOKENS = 1024
const MAX_TOKENS = 8192
const TOKEN_STEP = 256

function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function characterToDraft(
  character: Character,
): CharacterDraft {
  return {
    name: character.name,
    aliases: [
      ...character.aliases,
    ],
    role: character.role,
    summary: character.summary,
    personality: character.personality,
    appearance: character.appearance,
    background: character.background,
    age: character.age,
    goals: character.goals,
    fears: character.fears,
    motivations:
      character.motivations,
    notes: character.notes,
  }
}

function draftToCharacter(
  draft: CharacterDraft,
  existing: Character,
): Omit<
  Character,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    name: draft.name,
    aliases: [
      ...draft.aliases,
    ],
    role: draft.role,
    summary: draft.summary,
    personality:
      draft.personality,
    appearance:
      draft.appearance,
    background:
      draft.background,
    age: draft.age,
    goals: draft.goals,
    fears: draft.fears,
    motivations:
      draft.motivations,
    relationships:
      existing.relationships,
    notes: draft.notes,
    contextEnabled:
      existing.contextEnabled,
  }
}

function getChangedFields(
  original: CharacterDraft,
  proposed: CharacterDraft,
): CharacterDraftField[] {
  const fields: CharacterDraftField[] =
    [
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

  return fields.filter(
    (field) => {
      if (
        field === "aliases"
      ) {
        return (
          JSON.stringify(
            original.aliases,
          ) !==
          JSON.stringify(
            proposed.aliases,
          )
        )
      }

      return (
        original[field] !==
        proposed[field]
      )
    },
  )
}

export function CharacterImprovementPanel({
  character,
  onClose,
}: CharacterImprovementPanelProps) {
  const {
    project,
    activeScene,
    updateCharacter,
  } = useProject()

  const originalDraftRef =
    useRef<CharacterDraft>(
      characterToDraft(
        character,
      ),
    )

  const [
    draft,
    setDraft,
  ] = useState<CharacterDraft>(() =>
    characterToDraft(
      character,
    ),
  )

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([])

  const [
    input,
    setInput,
  ] = useState("")

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  const [
    hasPendingRevision,
    setHasPendingRevision,
  ] = useState(false)

  const [
    tokenBudget,
    setTokenBudget,
  ] = useState(
    loadCharacterImprovementTokens(),
  )

  const abortController =
    useRef<AbortController | null>(
      null,
    )

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  useEffect(() => {
    const freshDraft =
      characterToDraft(
        character,
      )

    originalDraftRef.current =
      freshDraft

    setDraft(freshDraft)
    setMessages([])
    setInput("")
    setError(null)
    setHasPendingRevision(false)

    setTokenBudget(
      loadCharacterImprovementTokens(),
    )
  }, [character])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      },
    )
  }, [
    messages,
    draft,
    hasPendingRevision,
  ])

  const updateTokenBudget = (
    value: number,
  ) => {
    const normalized =
      normalizeCharacterImprovementTokens(
        Math.min(
          MAX_TOKENS,
          Math.max(
            MIN_TOKENS,
            value,
          ),
        ),
      )

    setTokenBudget(
      normalized,
    )

    saveCharacterImprovementTokens(
      normalized,
    )
  }

  const stopGeneration = () => {
    const controller =
      abortController.current

    if (controller) {
      controller.abort()
      abortController.current =
        null
    }

    setIsLoading(false)
  }

  const close = () => {
    const controller =
      abortController.current

    if (controller) {
      controller.abort()
      abortController.current =
        null
    }

    setIsLoading(false)

    onClose()
  }

  const rejectRevision = () => {
    const original =
      originalDraftRef.current

    setDraft({
      ...original,
      aliases: [
        ...original.aliases,
      ],
    })

    setHasPendingRevision(false)
    setMessages([])
    setInput("")
    setError(null)
  }

  const applyImprovements = () => {
    try {
      updateCharacter(
        character.id,
        draftToCharacter(
          draft,
          character,
        ),
      )

      setMessages(
        (current) => [
          ...current,
          {
            id: newId(),
            role: "assistant",
            content: `The improvements to "${character.name}" have been applied.`,
          },
        ],
      )

      originalDraftRef.current = {
        ...draft,
        aliases: [
          ...draft.aliases,
        ],
      }

      setHasPendingRevision(
        false,
      )

      setError(null)
    } catch (err) {
      console.error(
        "Failed to apply character improvements:",
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the character.",
      )
    }
  }

  const sendMessage = async () => {
    const text =
      input.trim()

    if (
      !text ||
      isLoading
    ) {
      return
    }

    if (!activeScene) {
      setError(
        "There is no active scene available for the AI to use as story context.",
      )
      return
    }

    setInput("")
    setError(null)

    const userMessage: ChatMessage =
      {
        id: newId(),
        role: "user",
        content: text,
      }

    const nextMessages = [
      ...messages,
      userMessage,
    ]

    setMessages(
      nextMessages,
    )

    setIsLoading(true)

    const controller =
      new AbortController()

    abortController.current =
      controller

    try {
      /*
       * Character improvement is deliberately NOT
       * sent through streamAIChat().
       *
       * It uses the dedicated structured revision
       * service so the model has to return a complete
       * JSON patch.
       */
      const revision =
        await improveCharacter({
          character,
          draft,
          request: text,
          project,
          activeScene,
          previousMessages:
            nextMessages.map(
              (message) => ({
                role:
                  message.role,
                content:
                  message.content,
              }),
            ),
          signal:
            controller.signal,
          maxTokens:
            tokenBudget,
        })

      if (
        Object.keys(
          revision.changes,
        ).length === 0
      ) {
        setMessages(
          (current) => [
            ...current,
            {
              id: newId(),
              role: "assistant",
              content:
                revision.message,
            },
          ],
        )

        return
      }

      setDraft(
        (current) => ({
          ...current,
          ...revision.changes,
          aliases:
            revision.changes
              .aliases ??
            current.aliases,
        }),
      )

      setHasPendingRevision(
        true,
      )

      setMessages(
        (current) => [
          ...current,
          {
            id: newId(),
            role: "assistant",
            content:
              revision.message,
          },
        ],
      )
    } catch (err) {
      if (
        controller.signal.aborted
      ) {
        return
      }

      console.error(
        "Character improvement failed:",
        err,
      )

      setError(
        err instanceof Error
          ? err.message
          : "Character improvement failed.",
      )
    } finally {
      if (
        abortController.current ===
        controller
      ) {
        abortController.current =
          null
      }

      setIsLoading(false)
    }
  }

  const updateDraftField = (
    field: CharacterDraftField,
    value: string | string[],
  ) => {
    setDraft(
      (current) => ({
        ...current,
        [field]: value,
      }),
    )

    if (
      !hasPendingRevision
    ) {
      setHasPendingRevision(
        true,
      )
    }
  }

  const fields: {
    key: CharacterDraftField
    label: string
    multiline?: boolean
  }[] = [
    {
      key: "name",
      label: "Name",
    },
    {
      key: "aliases",
      label: "Aliases",
    },
    {
      key: "role",
      label: "Role",
    },
    {
      key: "age",
      label: "Age",
    },
    {
      key: "summary",
      label: "Summary",
      multiline: true,
    },
    {
      key: "personality",
      label: "Personality",
      multiline: true,
    },
    {
      key: "appearance",
      label: "Appearance",
      multiline: true,
    },
    {
      key: "background",
      label: "Background",
      multiline: true,
    },
    {
      key: "goals",
      label: "Goals",
      multiline: true,
    },
    {
      key: "fears",
      label: "Fears",
      multiline: true,
    },
    {
      key: "motivations",
      label: "Motivations",
      multiline: true,
    },
    {
      key: "notes",
      label: "Notes",
      multiline: true,
    },
  ]

  const changedFields =
    useMemo(
      () =>
        getChangedFields(
          originalDraftRef.current,
          draft,
        ),
      [draft],
    )

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-background/80
        p-4
        backdrop-blur-sm
      "
    >
      <div
        className="
          flex
          h-[90vh]
          w-full
          max-w-5xl
          min-h-0
          flex-col
          overflow-hidden
          rounded-xl
          border
          bg-background
          shadow-2xl
        "
      >
        {/* Header */}
        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            px-5
            py-4
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="
                flex
                size-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-muted
              "
            >
              <Bot className="size-4" />
            </div>

            <div className="min-w-0">
              <div className="font-semibold">
                Improve Character
              </div>

              <div className="text-xs text-muted-foreground">
                Improving{" "}
                <span className="font-medium text-foreground">
                  {character.name ||
                    "Unnamed character"}
                </span>
                .
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={close}
            aria-label="Close character improvement"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Character identity */}
        <div
          className="
            shrink-0
            border-b
            bg-muted/20
            px-5
            py-2.5
          "
        >
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" />

            <span className="font-medium">
              {character.name ||
                "Unnamed character"}
            </span>

            {character.role && (
              <>
                <span className="text-muted-foreground">
                  ·
                </span>

                <span className="truncate text-muted-foreground">
                  {character.role}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Main */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
          "
        >
          <div className="p-5">
            {/* Token budget */}
            <div
              className="
                mb-5
                rounded-xl
                border
                bg-muted/20
                p-4
              "
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">
                    Character AI response length
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    Higher values allow larger field expansions.
                  </div>
                </div>

                <div className="shrink-0 text-sm font-semibold">
                  {tokenBudget.toLocaleString()} tokens
                </div>
              </div>

              <input
                type="range"
                min={MIN_TOKENS}
                max={MAX_TOKENS}
                step={TOKEN_STEP}
                value={tokenBudget}
                onChange={(event) =>
                  updateTokenBudget(
                    Number(
                      event.target.value,
                    ),
                  )
                }
                className="mt-3 w-full"
                disabled={isLoading}
                aria-label="Character AI response token budget"
              />

              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>
                  {MIN_TOKENS.toLocaleString()}
                </span>
                <span>
                  {MAX_TOKENS.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Empty state */}
            {messages.length === 0 && (
              <div
                className="
                  mb-5
                  rounded-xl
                  border
                  border-dashed
                  p-5
                "
              >
                <div className="flex items-center gap-2 font-medium">
                  <Bot className="size-4" />
                  What would you like to improve?
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  Ask for a specific change. For
                  expansions, the AI will replace the
                  selected field with the complete,
                  expanded version.
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setInput(
                        "Expand her background with more detail while preserving everything already established.",
                      )
                    }
                    className="
                      rounded-lg
                      border
                      px-3
                      py-2
                      text-left
                      text-xs
                      text-muted-foreground
                      transition
                      hover:bg-muted
                      hover:text-foreground
                    "
                  >
                    Expand her background.
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setInput(
                        "Make her more morally ambiguous.",
                      )
                    }
                    className="
                      rounded-lg
                      border
                      px-3
                      py-2
                      text-left
                      text-xs
                      text-muted-foreground
                      transition
                      hover:bg-muted
                      hover:text-foreground
                    "
                  >
                    Make her more morally ambiguous.
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setInput(
                        "Give him a stronger reason to hate the empire.",
                      )
                    }
                    className="
                      rounded-lg
                      border
                      px-3
                      py-2
                      text-left
                      text-xs
                      text-muted-foreground
                      transition
                      hover:bg-muted
                      hover:text-foreground
                    "
                  >
                    Give him a stronger motivation.
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setInput(
                        "Make her personality more sarcastic and confident.",
                      )
                    }
                    className="
                      rounded-lg
                      border
                      px-3
                      py-2
                      text-left
                      text-xs
                      text-muted-foreground
                      transition
                      hover:bg-muted
                      hover:text-foreground
                    "
                  >
                    Make her more sarcastic.
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-3">
              {messages.map(
                (message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${
                      message.role ===
                      "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.role ===
                      "assistant" && (
                      <div
                        className="
                          mt-1
                          flex
                          size-7
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-muted
                        "
                      >
                        <Bot className="size-3.5" />
                      </div>
                    )}

                    <div
                      className={`
                        max-w-[80%]
                        whitespace-pre-wrap
                        rounded-xl
                        px-3
                        py-2
                        text-sm
                        ${
                          message.role ===
                          "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }
                      `}
                    >
                      {message.content}
                    </div>
                  </div>
                ),
              )}
            </div>

            {/* Proposed profile */}
            {hasPendingRevision && (
              <div
                className="
                  mt-5
                  rounded-xl
                  border
                  border-primary/20
                  bg-muted/20
                  p-4
                "
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <RefreshCw className="size-4" />
                      Proposed Character Revision
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      Nothing is saved until you
                      click "Apply Improvements".
                    </div>

                    {changedFields.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Changed fields:{" "}
                        {changedFields
                          .map(
                            (field) =>
                              field
                                .charAt(0)
                                .toUpperCase() +
                              field.slice(1),
                          )
                          .join(", ")}
                      </div>
                    )}
                  </div>

                  <User className="size-4 shrink-0 text-muted-foreground" />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {fields.map(
                    ({
                      key,
                      label,
                      multiline,
                    }) => {
                      const value =
                        key ===
                        "aliases"
                          ? draft.aliases.join(
                              ", ",
                            )
                          : String(
                              draft[key] ??
                                "",
                            )

                      return (
                        <label
                          key={String(
                            key,
                          )}
                          className={
                            multiline
                              ? "block space-y-1 md:col-span-2"
                              : "block space-y-1"
                          }
                        >
                          <span className="text-xs font-medium text-muted-foreground">
                            {label}
                          </span>

                          {multiline ? (
                            <textarea
                              value={value}
                              onChange={(event) =>
                                updateDraftField(
                                  key,
                                  key ===
                                    "aliases"
                                    ? event.target.value
                                        .split(",")
                                        .map(
                                          (
                                            item,
                                          ) =>
                                            item.trim(),
                                        )
                                        .filter(
                                          Boolean,
                                        )
                                    : event
                                        .target
                                        .value,
                                )
                              }
                              className="
                                min-h-20
                                w-full
                                resize-y
                                rounded-lg
                                border
                                border-input
                                bg-background
                                px-3
                                py-2
                                text-sm
                                leading-5
                                outline-none
                                transition
                                focus:ring-1
                                focus:ring-ring
                              "
                            />
                          ) : (
                            <input
                              value={value}
                              onChange={(event) =>
                                updateDraftField(
                                  key,
                                  key ===
                                    "aliases"
                                    ? event.target.value
                                        .split(",")
                                        .map(
                                          (
                                            item,
                                          ) =>
                                            item.trim(),
                                        )
                                        .filter(
                                          Boolean,
                                        )
                                    : event
                                        .target
                                        .value,
                                )
                              }
                              className="
                                w-full
                                rounded-lg
                                border
                                border-input
                                bg-background
                                px-3
                                py-2
                                text-sm
                                outline-none
                                transition
                                focus:ring-1
                                focus:ring-ring
                              "
                            />
                          )}
                        </label>
                      )
                    },
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={
                      applyImprovements
                    }
                  >
                    <Check className="mr-1.5 size-4" />
                    Apply Improvements
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={
                      rejectRevision
                    }
                    disabled={
                      isLoading
                    }
                  >
                    <X className="mr-1.5 size-4" />
                    Reject Revision
                  </Button>
                </div>
              </div>
            )}

            {isLoading && (
              <div
                className="
                  mt-4
                  flex
                  items-center
                  gap-2
                  text-xs
                  text-muted-foreground
                "
              >
                <RefreshCw className="size-3.5 animate-spin" />
                Generating complete character revision…
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="
              mx-5
              mb-2
              shrink-0
              rounded-lg
              border
              border-destructive/30
              bg-destructive/10
              px-3
              py-2.5
              text-xs
              text-destructive
            "
          >
            {error}
          </div>
        )}

        {/* Input */}
        <div
          className="
            shrink-0
            border-t
            bg-background
            p-4
          "
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              disabled={isLoading}
              onChange={(event) =>
                setInput(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault()

                  void sendMessage()
                }
              }}
              placeholder={`What would you like to improve about ${
                character.name ||
                "this character"
              }?`}
              className="
                min-h-20
                max-h-40
                flex-1
                resize-none
                rounded-lg
                border
                border-input
                bg-background
                px-3
                py-2.5
                text-sm
                leading-5
                outline-none
                transition
                placeholder:text-muted-foreground
                focus:ring-1
                focus:ring-ring
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            />

            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={
                  stopGeneration
                }
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() =>
                  void sendMessage()
                }
                disabled={
                  !input.trim()
                }
                title="Improve character"
                aria-label="Improve character"
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>

          <div
            className="
              mt-1.5
              text-[10px]
              text-muted-foreground
            "
          >
            Enter to send · Shift+Enter for a new line
          </div>
        </div>
      </div>
    </div>
  )
}
