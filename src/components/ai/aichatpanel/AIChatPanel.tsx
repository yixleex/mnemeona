import {
  MessageSquare,
  Send,
  Sparkles,
  Square,
} from "lucide-react"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"

import { useProject } from "@/context/ProjectContext"

import {
  streamAIChat,
  type AIMessage,
} from "@/components/ai/aiservice/aiService"

// --------------------------------------------------
// Types
// --------------------------------------------------

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

// --------------------------------------------------
// Quick Actions
// --------------------------------------------------

const aiActions = [
  {
    icon: Sparkles,
    label: "Continue writing",
    prompt:
      "Continue writing the current scene from where it currently ends. Match the existing tone, POV, tense, characters, and style. Write prose only.",
  },
  {
    icon: MessageSquare,
    label: "Ask about this",
    prompt:
      "Analyze the current scene and explain what is happening, including the important characters, relationships, conflicts, and relevant story context.",
  },
]

// --------------------------------------------------
// Component
// --------------------------------------------------

export function AIChatPanel() {
  const {
    project,
    activeScene,
  } = useProject()

  const [messages, setMessages] =
    useState<ChatMessage[]>([])

  const [input, setInput] =
    useState("")

  const [isLoading, setIsLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const abortController =
    useRef<AbortController | null>(null)

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null)

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null)

  // --------------------------------------------------
  // Scroll to latest message
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages])

  // --------------------------------------------------
  // Stop generation
  // --------------------------------------------------

  const stopGeneration = () => {
    abortController.current?.abort()
    abortController.current = null

    setIsLoading(false)
  }

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------

  const sendMessage = async (
    messageText?: string,
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

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    }

    const assistantId =
      crypto.randomUUID()

    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    }

    const nextMessages = [
      ...messages,
      userMessage,
    ]

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
            content: message.content,
          }),
        )

      await streamAIChat({
        messages: aiMessages,
        project,
        activeScene,
        signal:
          controller.signal,

        onToken: (token) => {
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
        err.name === "AbortError"
      ) {
        return
      }

      if (
        err instanceof Error
      ) {
        setError(err.message)
      } else {
        setError(
          "Something went wrong while communicating with the AI.",
        )
      }

      // Remove empty assistant message
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
    }
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
  // Keyboard handling
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
    <aside className="flex w-80 shrink-0 flex-col border-l">

      {/* ------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------ */}

      <header className="shrink-0 border-b px-4 py-3">
        <div className="text-sm font-medium">
          Mnemeona AI
        </div>

        <div className="text-[11px] text-muted-foreground">
          {activeScene
            ? `Working with "${activeScene.title}"`
            : "Your writing companion"}
        </div>
      </header>

      {/* ------------------------------------------------ */}
      {/* Conversation */}
      {/* ------------------------------------------------ */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">

          {/* Empty state */}

          {messages.length === 0 ? (
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
                        className="w-full justify-start gap-2"
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
                        <Icon className="size-4" />

                        {
                          action.label
                        }
                      </Button>
                    )
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">

              {messages.map(
                (message) => (
                  <div
                    key={
                      message.id
                    }
                    className={
                      message.role ===
                      "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        message.role ===
                        "user"
                          ? "max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                          : "max-w-[95%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm"
                      }
                    >
                      {message.content ||
                        (isLoading &&
                        message.role ===
                          "assistant"
                          ? (
                            <span className="text-muted-foreground">
                              Thinking...
                            </span>
                          )
                          : null)}

                      {message.role ===
                        "assistant" &&
                        isLoading &&
                        message.content && (
                          <span className="ml-0.5 inline-block animate-pulse">
                            ▋
                          </span>
                        )}
                    </div>
                  </div>
                ),
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
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div
            ref={
              messagesEndRef
            }
          />
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* Input */}
      {/* ------------------------------------------------ */}

      <div className="shrink-0 border-t p-3">
        <div className="rounded-xl border bg-background p-2">

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) =>
              setInput(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            disabled={isLoading}
            placeholder={
              activeScene
                ? "Ask Mnemeona..."
                : "Select a scene first..."
            }
            className="min-h-16 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-2 px-1">

            <span className="text-[10px] text-muted-foreground">
              Enter to send · Shift+Enter for newline
            </span>

            {isLoading ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-8 rounded-lg p-0"
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
                className="size-8 rounded-lg p-0"
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
