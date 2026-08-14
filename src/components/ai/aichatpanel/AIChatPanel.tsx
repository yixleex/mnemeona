import {
  Bot,
  Check,
  Clipboard,
  ChevronDown,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  WandSparkles,
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
  buildAIContext,
  buildSystemPrompt,
  extractSceneText,
  streamAIChat,
  type AIMessage,
} from "@/components/ai/aiservice/aiService"

import type { JSONContent } from "@tiptap/core"

// --------------------------------------------------
// Types
// --------------------------------------------------

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

type ContextMode =
  | "scene"
  | "context"
  | "full"

interface StoredConversation {
  messages: ChatMessage[]
  contextMode: ContextMode
}

// --------------------------------------------------
// Storage
// --------------------------------------------------

const CHAT_STORAGE_PREFIX =
  "mnemeona-ai-chat"

function getConversationStorageKey(
  project: unknown,
  sceneId: string,
): string {
  const projectObject =
    project as {
      id?: string
      title?: string
      name?: string
    } | null

  const projectId =
    projectObject?.id ||
    projectObject?.title ||
    projectObject?.name ||
    "default-project"

  return `${CHAT_STORAGE_PREFIX}:${String(projectId)}:${sceneId}`
}

function loadConversation(
  key: string,
): StoredConversation {
  try {
    const stored =
      localStorage.getItem(key)

    if (!stored) {
      return {
        messages: [],
        contextMode: "full",
      }
    }

    const parsed =
      JSON.parse(stored) as Partial<StoredConversation>

    return {
      messages:
        Array.isArray(parsed.messages)
          ? parsed.messages
          : [],
      contextMode:
        parsed.contextMode === "scene" ||
        parsed.contextMode === "context" ||
        parsed.contextMode === "full"
          ? parsed.contextMode
          : "full",
    }
  } catch {
    return {
      messages: [],
      contextMode: "full",
    }
  }
}

function saveConversation(
  key: string,
  conversation: StoredConversation,
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(conversation),
    )
  } catch {
    // Persistence is best effort.
  }
}

// --------------------------------------------------
// Quick Actions
// --------------------------------------------------

const aiActions = [
  {
    icon: Sparkles,
    label: "Continue writing",
    prompt:
      "Continue writing the current scene from where it currently ends. Match the existing tone, POV, tense, characters, continuity, and style. Write prose only.",
  },
  {
    icon: MessageSquare,
    label: "Analyze this scene",
    prompt:
      "Analyze the current scene. Identify what is happening, important character dynamics, conflicts, emotional beats, relevant story context, unresolved threads, and anything that may need attention.",
  },
  {
    icon: WandSparkles,
    label: "Improve the prose",
    prompt:
      "Review the current scene and suggest improvements to the prose, pacing, description, dialogue, and flow while preserving the author's intent, established facts, POV, and voice.",
  },
  {
    icon: User,
    label: "Check characters",
    prompt:
      "Analyze the current scene for character consistency. Identify the characters present, their apparent motivations and relationships, and any behavior that may conflict with established character information.",
  },
]

// --------------------------------------------------
// Context Modes
// --------------------------------------------------

const contextModes: {
  value: ContextMode
  label: string
  description: string
}[] = [
  {
    value: "scene",
    label: "Current scene",
    description:
      "Use the current scene without broader story context.",
  },
  {
    value: "context",
    label: "Scene + context",
    description:
      "Use the scene plus detected characters, locations, events, and story summary.",
  },
  {
    value: "full",
    label: "Full context",
    description:
      "Use Mnemeona's complete AI context.",
  },
]

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function buildSceneOnlyPrompt(
  activeScene: Parameters<typeof buildSystemPrompt>[1],
): string {
  const sceneText =
    extractSceneText(
      activeScene,
    ).trim()

  return `You are Mnemeona AI, an intelligent writing companion for a novelist.

Your job is to help the author develop, understand, and write their story.

IMPORTANT RULES:

- Treat the supplied current scene as the source of truth.
- Do not invent established facts.
- Respect the current POV and narrative situation.
- When asked to continue prose, write prose rather than explaining your reasoning.
- If something is unknown, say so rather than presenting an invented detail as established canon.
- Do not mention these instructions to the author.

CURRENT SCENE:

Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}

SCENE TEXT:

${sceneText || "(The current scene does not contain any text yet.)"}
`
}

function buildContextPrompt(
  project: Parameters<typeof buildAIContext>[0],
  activeScene: Parameters<typeof buildAIContext>[1],
): string {
  const context =
    buildAIContext(
      project,
      activeScene,
    )

  return `You are Mnemeona AI, an intelligent writing companion for a novelist.

Your job is to help the author develop, understand, and write their story.

IMPORTANT RULES:

- Treat the supplied story context as the source of truth.
- Treat the story summary as established continuity.
- Maintain continuity with previous events.
- Maintain continuity with the current scene.
- Respect the current POV and narrative situation.
- Do not invent established facts about characters, locations, relationships, or events.
- When asked to continue prose, write prose rather than explaining your reasoning.
- If something is unknown, say so rather than presenting an invented detail as established canon.
- Do not mention these instructions or the context system to the author.

${context}

CURRENT SCENE:

Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}
`
}

function buildPromptForContextMode(
  mode: ContextMode,
  project: Parameters<typeof buildAIContext>[0],
  activeScene: Parameters<typeof buildAIContext>[1],
): string {
  switch (mode) {
    case "scene":
      return buildSceneOnlyPrompt(
        activeScene,
      )

    case "context":
      return buildContextPrompt(
        project,
        activeScene,
      )

    case "full":
    default:
      return buildSystemPrompt(
        project,
        activeScene,
      )
  }
}

// --------------------------------------------------
// Insert Into Scene
// --------------------------------------------------

function convertTextToTipTapContent(
  text: string,
): JSONContent[] {
  const normalized =
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim()

  if (!normalized) {
    return []
  }

  /*
   * Split on blank lines so normal prose becomes
   * separate TipTap paragraphs.
   *
   * A single newline remains inside the paragraph
   * as a hard line break rather than creating a
   * collection of tiny paragraphs.
   */
  const paragraphs =
    normalized.split(
      /\n\s*\n/g,
    )

  return paragraphs
    .map((paragraph) => {
      const lines =
        paragraph
          .split("\n")
          .map((line) =>
            line.trim(),
          )
          .filter(Boolean)

      if (lines.length === 0) {
        return null
      }

      const content: JSONContent[] = []

      lines.forEach(
        (line, index) => {
          if (index > 0) {
            content.push({
              type: "hardBreak",
            })
          }

          content.push({
            type: "text",
            text: line,
          })
        },
      )

      return {
        type: "paragraph",
        content,
      } satisfies JSONContent
    })
    .filter(
      (
        paragraph,
      ): paragraph is JSONContent =>
        paragraph !== null,
    )
}

function appendTextToSceneContent(
  existingContent: JSONContent | undefined,
  text: string,
): JSONContent {
  const newParagraphs =
    convertTextToTipTapContent(
      text,
    )

  const existing =
    existingContent ?? {
      type: "doc",
      content: [],
    }

  const existingContentArray =
    Array.isArray(
      existing.content,
    )
      ? existing.content
      : []

  /*
   * Add a paragraph separator before the
   * generated content when the existing scene
   * already contains content.
   */
  const separator: JSONContent[] =
    existingContentArray.length >
    0
      ? [
          {
            type: "paragraph",
          },
        ]
      : []

  return {
    ...existing,
    type: "doc",
    content: [
      ...existingContentArray,
      ...separator,
      ...newParagraphs,
    ],
  }
}

// --------------------------------------------------
// Component
// --------------------------------------------------

export function AIChatPanel() {
  const {
    project,
    activeScene,
    updateSceneContent,
  } = useProject()

  const storageKey = useMemo(
    () =>
      activeScene
        ? getConversationStorageKey(
            project,
            activeScene.id,
          )
        : null,
    [project, activeScene],
  )

  const [messages, setMessages] =
    useState<ChatMessage[]>([])

  const [input, setInput] =
    useState("")

  const [isLoading, setIsLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [contextMode, setContextMode] =
    useState<ContextMode>("full")

  const [showContextMenu, setShowContextMenu] =
    useState(false)

  const [copiedMessageId, setCopiedMessageId] =
    useState<string | null>(null)

  const [insertedMessageId, setInsertedMessageId] =
    useState<string | null>(null)

  const abortController =
    useRef<AbortController | null>(null)

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null)

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null)

  // --------------------------------------------------
  // Load conversation
  // --------------------------------------------------

  useEffect(() => {
    if (!storageKey) {
      setMessages([])
      setContextMode("full")
      return
    }

    const stored =
      loadConversation(
        storageKey,
      )

    setMessages(
      stored.messages,
    )

    setContextMode(
      stored.contextMode,
    )

    setError(null)
    setInput("")
    setInsertedMessageId(null)
  }, [storageKey])

  // --------------------------------------------------
  // Persist conversation
  // --------------------------------------------------

  useEffect(() => {
    if (!storageKey) {
      return
    }

    saveConversation(
      storageKey,
      {
        messages,
        contextMode,
      },
    )
  }, [
    storageKey,
    messages,
    contextMode,
  ])

  // --------------------------------------------------
  // Scroll
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      },
    )
  }, [messages])

  // --------------------------------------------------
  // Auto-grow textarea
  // --------------------------------------------------

  useEffect(() => {
    const textarea =
      textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height =
      "auto"

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        180,
      )}px`
  }, [input])

  // --------------------------------------------------
  // Context metadata
  // --------------------------------------------------

  const contextLabel =
    contextModes.find(
      (mode) =>
        mode.value ===
        contextMode,
    )?.label ??
    "Full context"

  // --------------------------------------------------
  // Stop generation
  // --------------------------------------------------

  const stopGeneration = () => {
    abortController.current?.abort()

    abortController.current = null

    setIsLoading(false)
  }

  // --------------------------------------------------
  // Clear conversation
  // --------------------------------------------------

  const clearConversation = () => {
    if (isLoading) {
      stopGeneration()
    }

    setMessages([])
    setError(null)
    setInput("")
    setInsertedMessageId(null)
  }

  // --------------------------------------------------
  // Copy
  // --------------------------------------------------

  const copyMessage = async (
    message: ChatMessage,
  ) => {
    try {
      await navigator.clipboard.writeText(
        message.content,
      )

      setCopiedMessageId(
        message.id,
      )

      window.setTimeout(() => {
        setCopiedMessageId(
          (current) =>
            current === message.id
              ? null
              : current,
        )
      }, 1500)
    } catch {
      setError(
        "Unable to copy the response to the clipboard.",
      )
    }
  }

  // --------------------------------------------------
  // Insert into Scene
  // --------------------------------------------------

  const insertIntoScene = (
    message: ChatMessage,
  ) => {
    if (
      !activeScene ||
      !message.content.trim()
    ) {
      return
    }

    try {
      const updatedContent =
        appendTextToSceneContent(
          activeScene.content,
          message.content,
        )

      updateSceneContent(
        activeScene.id,
        updatedContent,
      )

      setInsertedMessageId(
        message.id,
      )

      window.setTimeout(() => {
        setInsertedMessageId(
          (current) =>
            current === message.id
              ? null
              : current,
        )
      }, 1800)

      setError(null)
    } catch (err) {
      console.error(
        "Failed to insert AI response into scene:",
        err,
      )

      setError(
        "Unable to insert the AI response into the current scene.",
      )
    }
  }

  // --------------------------------------------------
  // Send
  // --------------------------------------------------

  const sendMessage = async (
    messageText?: string,
    options?: {
      replaceLastUserMessage?: boolean
      existingUserMessageId?: string
    },
  ) => {
    const text =
      (
        messageText ??
        input
      ).trim()

    if (!text) {
      return
    }

    if (!activeScene) {
      setError(
        "Select a scene before chatting with Mnemeona AI.",
      )

      return
    }

    if (isLoading) {
      return
    }

    setError(null)
    setInput("")

    let nextMessages: ChatMessage[]

    let userMessage: ChatMessage

    if (
      options?.replaceLastUserMessage &&
      options.existingUserMessageId
    ) {
      userMessage = {
        id:
          options.existingUserMessageId,
        role: "user",
        content: text,
      }

      nextMessages =
        messages.map(
          (message) =>
            message.id ===
            options.existingUserMessageId
              ? userMessage
              : message,
        )

      const index =
        nextMessages.findIndex(
          (message) =>
            message.id ===
            options.existingUserMessageId,
        )

      if (index >= 0) {
        nextMessages =
          nextMessages.slice(
            0,
            index + 1,
          )
      }
    } else {
      userMessage = {
        id:
          crypto.randomUUID(),
        role: "user",
        content: text,
      }

      nextMessages = [
        ...messages,
        userMessage,
      ]
    }

    const assistantId =
      crypto.randomUUID()

    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    }

    setMessages([
      ...nextMessages,
      assistantMessage,
    ])

    setIsLoading(true)

    const controller =
      new AbortController()

    abortController.current =
      controller

    try {
      const aiMessages: AIMessage[] =
        nextMessages.map(
          (message) => ({
            role: message.role,
            content:
              message.content,
          }),
        )

      const systemPrompt =
        buildPromptForContextMode(
          contextMode,
          project,
          activeScene,
        )

      await streamAIChat({
        messages:
          aiMessages,
        project,
        activeScene,
        systemPrompt,
        signal:
          controller.signal,

        onToken: (
          token,
        ) => {
          setMessages(
            (current) =>
              current.map(
                (message) =>
                  message.id ===
                  assistantId
                    ? {
                        ...message,
                        content:
                          message.content +
                          token,
                      }
                    : message,
              ),
          )
        },
      })
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name ===
          "AbortError"
      ) {
        return
      }

      if (
        err instanceof Error
      ) {
        setError(
          err.message,
        )
      } else {
        setError(
          "Something went wrong while communicating with the AI.",
        )
      }

      /*
       * Preserve partial responses.
       */
      setMessages(
        (current) =>
          current.filter(
            (message) =>
              message.id !==
                assistantId ||
              message.content.length >
                0,
          ),
      )
    } finally {
      abortController.current =
        null

      setIsLoading(false)

      window.setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    }
  }

  // --------------------------------------------------
  // Regenerate
  // --------------------------------------------------

  const regenerateMessage = (
    assistantMessageId: string,
  ) => {
    if (
      isLoading ||
      !activeScene
    ) {
      return
    }

    const assistantIndex =
      messages.findIndex(
        (message) =>
          message.id ===
          assistantMessageId,
      )

    if (assistantIndex < 0) {
      return
    }

    const previousUserMessage =
      [...messages]
        .slice(0, assistantIndex)
        .reverse()
        .find(
          (message) =>
            message.role ===
            "user",
        )

    if (!previousUserMessage) {
      return
    }

    sendMessage(
      previousUserMessage.content,
      {
        replaceLastUserMessage: true,
        existingUserMessageId:
          previousUserMessage.id,
      },
    )
  }

  // --------------------------------------------------
  // Retry
  // --------------------------------------------------

  const retryLastMessage = () => {
    if (
      isLoading ||
      !activeScene
    ) {
      return
    }

    const lastUserMessage =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role ===
            "user",
        )

    if (!lastUserMessage) {
      return
    }

    sendMessage(
      lastUserMessage.content,
      {
        replaceLastUserMessage: true,
        existingUserMessageId:
          lastUserMessage.id,
      },
    )
  }

  // --------------------------------------------------
  // Quick action
  // --------------------------------------------------

  const handleAction = (
    prompt: string,
  ) => {
    sendMessage(prompt)
  }

  // --------------------------------------------------
  // Keyboard
  // --------------------------------------------------

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault()

      sendMessage()
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background">

      {/* Header */}

      <header className="relative shrink-0 border-b">

        <div className="flex items-center justify-between px-4 py-3">

          <div className="min-w-0">

            <div className="flex items-center gap-2 text-sm font-medium">

              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent">
                <Sparkles className="size-3.5 text-accent-foreground" />
              </div>

              <span>
                Mnemeona AI
              </span>

            </div>

            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              {activeScene
                ? `Working with "${activeScene.title}"`
                : "Your writing companion"}
            </div>

          </div>

          <div className="flex items-center gap-1">

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={() => {
                setMessages([])
                setError(null)
                setInput("")
                setInsertedMessageId(null)
              }}
              disabled={
                isLoading ||
                messages.length === 0
              }
              title="New conversation"
            >
              <Plus className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={
                clearConversation
              }
              disabled={
                isLoading ||
                messages.length === 0
              }
              title="Clear conversation"
            >
              <Trash2 className="size-3.5" />
            </Button>

          </div>

        </div>

        {/* Context selector */}

        <div className="border-t px-3 py-2">

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
            onClick={() =>
              setShowContextMenu(
                (current) =>
                  !current,
              )
            }
          >

            <div className="flex min-w-0 items-center gap-2">

              <Settings2 className="size-3.5 shrink-0 text-muted-foreground" />

              <div className="min-w-0">

                <div className="truncate text-[11px] font-medium">
                  {contextLabel}
                </div>

                <div className="truncate text-[10px] text-muted-foreground">
                  AI context mode
                </div>

              </div>

            </div>

            <ChevronDown
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                showContextMenu
                  ? "rotate-180"
                  : ""
              }`}
            />

          </button>

          {showContextMenu && (
            <div className="mt-1 rounded-lg border bg-popover p-1 shadow-md">

              {contextModes.map(
                (mode) => (
                  <button
                    key={
                      mode.value
                    }
                    type="button"
                    className={`w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent ${
                      contextMode ===
                      mode.value
                        ? "bg-accent"
                        : ""
                    }`}
                    onClick={() => {
                      setContextMode(
                        mode.value,
                      )

                      setShowContextMenu(
                        false,
                      )
                    }}
                  >

                    <div className="flex items-start gap-2">

                      <div className="mt-0.5 flex size-4 items-center justify-center">

                        {contextMode ===
                          mode.value && (
                          <Check className="size-3.5" />
                        )}

                      </div>

                      <div className="min-w-0">

                        <div className="text-xs font-medium">
                          {mode.label}
                        </div>

                        <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                          {
                            mode.description
                          }
                        </div>

                      </div>

                    </div>

                  </button>
                ),
              )}

            </div>
          )}

        </div>

      </header>

      {/* Conversation */}

      <div className="min-h-0 flex-1 overflow-y-auto">

        <div className="p-4">

          {messages.length ===
          0 ? (
            <div className="flex min-h-full flex-col items-center justify-center text-center">

              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent">
                <Sparkles className="size-5 text-accent-foreground" />
              </div>

              <h2 className="text-base font-medium">
                What are we writing?
              </h2>

              <p className="mt-1 max-w-60 text-sm leading-6 text-muted-foreground">
                {activeScene
                  ? `Ask me anything about "${activeScene.title}" or your story.`
                  : "Select a scene in your manuscript or ask me something about your story."}
              </p>

              <div className="mt-6 w-full space-y-2">

                {aiActions.map(
                  (action) => {
                    const Icon =
                      action.icon

                    return (
                      <Button
                        key={
                          action.label
                        }
                        variant="outline"
                        className="h-auto w-full justify-start gap-2 px-3 py-2.5 text-left"
                        disabled={
                          !activeScene ||
                          isLoading
                        }
                        onClick={() =>
                          handleAction(
                            action.prompt,
                          )
                        }
                      >
                        <Icon className="size-4 shrink-0" />

                        <span className="truncate">
                          {
                            action.label
                          }
                        </span>
                      </Button>
                    )
                  },
                )}

              </div>

            </div>
          ) : (
            <div className="space-y-5">

              {messages.map(
                (message) => {

                  const isUser =
                    message.role ===
                    "user"

                  const isEmptyAssistant =
                    !isUser &&
                    !message.content &&
                    isLoading

                  return (
                    <div
                      key={
                        message.id
                      }
                      className={
                        isUser
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >

                      <div
                        className={
                          isUser
                            ? "max-w-[92%]"
                            : "max-w-[96%]"
                        }
                      >

                        {/* Role */}

                        <div
                          className={`mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground ${
                            isUser
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >

                          {isUser ? (
                            <>
                              <span>
                                You
                              </span>

                              <User className="size-3" />
                            </>
                          ) : (
                            <>
                              <Bot className="size-3" />

                              <span>
                                Mnemeona AI
                              </span>
                            </>
                          )}

                        </div>

                        {/* Message */}

                        <div
                          className={
                            isUser
                              ? "rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-sm text-primary-foreground"
                              : "rounded-2xl rounded-bl-md bg-muted px-3 py-2.5 text-sm"
                          }
                        >

                          {isEmptyAssistant ? (
                            <span className="text-muted-foreground">
                              Thinking...
                            </span>
                          ) : (
                            <div className="whitespace-pre-wrap break-words leading-6">
                              {
                                message.content
                              }

                              {!isUser &&
                                isLoading &&
                                message.content && (
                                  <span className="ml-0.5 inline-block animate-pulse">
                                    ▋
                                  </span>
                                )}
                            </div>
                          )}

                        </div>

                        {/* Assistant actions */}

                        {!isUser &&
                          message.content &&
                          !isLoading && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">

                            {/* Copy */}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[10px]"
                              onClick={() =>
                                copyMessage(
                                  message,
                                )
                              }
                            >
                              {copiedMessageId ===
                              message.id ? (
                                <Check className="size-3" />
                              ) : (
                                <Clipboard className="size-3" />
                              )}

                              {copiedMessageId ===
                              message.id
                                ? "Copied"
                                : "Copy"}
                            </Button>

                            {/* Regenerate */}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[10px]"
                              onClick={() =>
                                regenerateMessage(
                                  message.id,
                                )
                              }
                            >
                              <RefreshCw className="size-3" />

                              Regenerate
                            </Button>

                            {/* Insert */}

                            <Button
                              type="button"
                              variant={
                                insertedMessageId ===
                                message.id
                                  ? "secondary"
                                  : "ghost"
                              }
                              size="sm"
                              className="h-7 gap-1 px-2 text-[10px]"
                              onClick={() =>
                                insertIntoScene(
                                  message,
                                )
                              }
                              disabled={
                                !activeScene
                              }
                              title={
                                activeScene
                                  ? "Append this response to the current scene"
                                  : "Select a scene first"
                              }
                            >
                              {insertedMessageId ===
                              message.id ? (
                                <Check className="size-3" />
                              ) : (
                                <Plus className="size-3" />
                              )}

                              {insertedMessageId ===
                              message.id
                                ? "Inserted"
                                : "Insert"}
                            </Button>

                          </div>
                        )}

                      </div>

                    </div>
                  )
                },
              )}

              <div
                ref={
                  messagesEndRef
                }
              />

            </div>
          )}

          {/* Error */}

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">

              <div className="flex items-start gap-2">

                <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />

                <div className="min-w-0 flex-1 text-xs leading-5 text-destructive">
                  {error}
                </div>

              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={
                  retryLastMessage
                }
                disabled={
                  isLoading ||
                  !messages.some(
                    (message) =>
                      message.role ===
                      "user",
                  )
                }
              >
                <RefreshCw className="size-3" />
                Retry
              </Button>

            </div>
          )}

        </div>

      </div>

      {/* Input */}

      <div className="shrink-0 border-t p-3">

        <div className="rounded-xl border bg-background p-2">

          <textarea
            ref={
              textareaRef
            }
            value={input}
            onChange={(
              event,
            ) =>
              setInput(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            disabled={
              isLoading
            }
            placeholder={
              activeScene
                ? "Ask Mnemeona..."
                : "Select a scene first..."
            }
            rows={2}
            className="max-h-[180px] min-h-16 w-full resize-none overflow-y-auto bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-2 px-1 pt-1">

            <div className="min-w-0">

              <span className="text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for newline
              </span>

              {input.length >
                0 && (
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {input.length}
                </span>
              )}

            </div>

            {isLoading ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-8 shrink-0 rounded-lg p-0"
                onClick={
                  stopGeneration
                }
                title="Stop generating"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="size-8 shrink-0 rounded-lg p-0"
                disabled={
                  !input.trim() ||
                  !activeScene
                }
                onClick={() =>
                  sendMessage()
                }
                title="Send message"
              >
                <Send className="size-4" />
              </Button>
            )}

          </div>

        </div>

      </div>

    </aside>
  )
}
