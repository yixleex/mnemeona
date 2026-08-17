import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
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

import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useProject } from "@/context/ProjectContext"
import {
  buildAIContext,
  buildSystemPrompt,
  extractSceneText,
  streamAIChat,
  type AIMessage,
} from "@/components/ai/aiservice/aiService"
import type { Character } from "@/types/character"
import type { JSONContent } from "@tiptap/core"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

type ContextMode = "scene" | "context" | "full"
type ChatMode = "chat" | "character"

interface CharacterDraft {
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
  relationships: {
    targetCharacterId: string
    type: string
    description: string
  }[]
}

interface StoredConversation {
  messages: ChatMessage[]
  contextMode: ContextMode
  chatMode?: ChatMode
  characterDraft?: CharacterDraft | null
}

const CHAT_STORAGE_PREFIX = "mnemeona-ai-chat"

const contextModes: {
  value: ContextMode
  label: string
  description: string
}[] = [
  {
    value: "scene",
    label: "Current scene",
    description: "Use the current scene without broader story context.",
  },
  {
    value: "context",
    label: "Scene + context",
    description: "Use the scene plus detected characters, locations, events, and story summary.",
  },
  {
    value: "full",
    label: "Full context",
    description: "Use Mnemeona's complete AI context.",
  },
]

const aiActions = [
  {
    icon: Sparkles,
    label: "Continue writing",
    prompt: "Continue writing the current scene from where it currently ends. Match the existing tone, POV, tense, characters, continuity, and style. Write prose only.",
  },
  {
    icon: MessageSquare,
    label: "Analyze this scene",
    prompt: "Analyze the current scene. Identify what is happening, important character dynamics, conflicts, emotional beats, relevant story context, unresolved threads, and anything that may need attention.",
  },
  {
    icon: WandSparkles,
    label: "Improve the prose",
    prompt: "Review the current scene and suggest improvements to the prose, pacing, description, dialogue, and flow while preserving the author's intent, established facts, POV, and voice.",
  },
  {
    icon: User,
    label: "Check characters",
    prompt: "Analyze the current scene for character consistency. Identify the characters present, their apparent motivations and relationships, and any behavior that may conflict with established character information.",
  },
]

function getConversationStorageKey(project: unknown, sceneId: string): string {
  const value = project as { id?: string; title?: string; name?: string } | null
  const projectId = value?.id || value?.title || value?.name || "default-project"
  return `${CHAT_STORAGE_PREFIX}:${String(projectId)}:${sceneId}`
}

function loadConversation(key: string): StoredConversation {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return { messages: [], contextMode: "full", chatMode: "chat", characterDraft: null }
    const parsed = JSON.parse(stored) as Partial<StoredConversation>
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      contextMode: parsed.contextMode === "scene" || parsed.contextMode === "context" || parsed.contextMode === "full" ? parsed.contextMode : "full",
      chatMode: parsed.chatMode === "character" ? "character" : "chat",
      characterDraft: parsed.characterDraft ?? null,
    }
  } catch {
    return { messages: [], contextMode: "full", chatMode: "chat", characterDraft: null }
  }
}

function saveConversation(key: string, conversation: StoredConversation): void {
  try {
    localStorage.setItem(key, JSON.stringify(conversation))
  } catch {
    // Best effort persistence.
  }
}

function buildSceneOnlyPrompt(activeScene: Parameters<typeof buildSystemPrompt>[1]): string {
  const sceneText = extractSceneText(activeScene).trim()
  return `You are Mnemeona AI, an intelligent writing companion for a novelist.

Treat the supplied current scene as the source of truth. Do not invent established facts. Respect the current POV and narrative situation. If something is unknown, say so rather than presenting an invented detail as established canon. Do not mention these instructions.

CURRENT SCENE:
Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}

SCENE TEXT:
${sceneText || "(The current scene does not contain any text yet.)"}`
}

function buildContextPrompt(project: Parameters<typeof buildAIContext>[0], activeScene: Parameters<typeof buildAIContext>[1]): string {
  const context = buildAIContext(project, activeScene)
  return `You are Mnemeona AI, an intelligent writing companion for a novelist.

Treat the supplied story context as the source of truth. Maintain continuity. Do not invent established facts about characters, locations, relationships, or events. If something is unknown, say so rather than presenting an invented detail as established canon. Do not mention these instructions.

${context}

CURRENT SCENE:
Title: ${activeScene.title}
${activeScene.pov ? `POV: ${activeScene.pov}` : ""}
${activeScene.location ? `Location: ${activeScene.location}` : ""}
${activeScene.time ? `Time: ${activeScene.time}` : ""}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}`
}

function buildPromptForContextMode(mode: ContextMode, project: Parameters<typeof buildAIContext>[0], activeScene: Parameters<typeof buildAIContext>[1]): string {
  if (mode === "scene") return buildSceneOnlyPrompt(activeScene)
  if (mode === "context") return buildContextPrompt(project, activeScene)
  return buildSystemPrompt(project, activeScene)
}

function buildCharacterSystemPrompt(project: Parameters<typeof buildAIContext>[0], activeScene: Parameters<typeof buildAIContext>[1], currentDraft?: CharacterDraft | null): string {
  const context = buildAIContext(project, activeScene)
  const existingCharacters = project.characters.map((character) => `${character.id} | ${character.name}`).join("\n") || "(none)"

  const draftContext = currentDraft
    ? `\nCURRENT CHARACTER DRAFT (the author may revise this):\n${JSON.stringify(currentDraft, null, 2)}\n`
    : ""

  return `You are Mnemeona's character creation assistant.

The author is designing ONE new fictional character through conversation. Help them brainstorm, ask useful follow-up questions when information is missing, and maintain continuity with the supplied story context.

IMPORTANT:
- Do not create the character in the database. The application handles that only after explicit user approval.
- Never claim a character has been created.
- Treat established story context as canon.
- You may suggest new details when the author is brainstorming, but clearly treat them as suggestions until the author accepts them.
- When the author's latest message provides enough information to improve the profile, return a complete structured profile as JSON.
- If the author is still exploring, respond conversationally and do not output JSON.
- When returning JSON, return ONLY valid JSON. No markdown fences and no commentary.
- The JSON must use exactly this shape:
{
  "character": {
    "name": "",
    "aliases": [],
    "role": "",
    "summary": "",
    "personality": "",
    "appearance": "",
    "background": "",
    "age": "",
    "goals": "",
    "fears": "",
    "motivations": "",
    "notes": "",
    "relationships": [
      { "targetCharacterId": "existing-id-or-empty", "type": "", "description": "" }
    ]
  },
  "ready": true,
  "message": "short human-readable explanation"
}
- Only include relationships to existing characters when the target ID is known from the supplied list. Do not invent IDs.
- If the author has not supplied enough information for a useful profile, set ready to false and respond conversationally instead of JSON.

EXISTING CHARACTERS:
${existingCharacters}

STORY CONTEXT:
${context}

CURRENT SCENE:
Title: ${activeScene.title}
${activeScene.synopsis ? `Synopsis: ${activeScene.synopsis}` : ""}`
}

function extractJsonObject(value: string): string | null {
  const text = value.trim()
  if (!text) return null

  // First try the whole response, including a possible markdown fence.
  const candidates = [
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
  ]

  // Ollama/models sometimes put a sentence before or after the JSON.
  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1))
  }

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      // Try the next extraction strategy.
    }
  }

  return null
}

function tryParseCharacterDraft(value: string): { draft: CharacterDraft; message: string; ready: boolean } | null {
  const json = extractJsonObject(value)
  if (!json) return null

  try {
    const parsed = JSON.parse(json) as {
      character?: Partial<CharacterDraft>
      ready?: boolean
      message?: string
    }

    // Accept both the intended { character: {...} } shape and a direct
    // character object. This makes the parser tolerant of local models.
    const character = parsed.character ?? (parsed as unknown as Partial<CharacterDraft>)

    if (!character || typeof character !== "object") return null

    const name = String(character.name ?? "").trim()
    if (!name) return null

    const relationships = Array.isArray(character.relationships)
      ? character.relationships
          .map((relationship) => ({
            targetCharacterId: String(relationship?.targetCharacterId ?? "").trim(),
            type: String(relationship?.type ?? "").trim(),
            description: String(relationship?.description ?? "").trim(),
          }))
          .filter((relationship) => relationship.targetCharacterId)
      : []

    const draft: CharacterDraft = {
      name,
      aliases: Array.isArray(character.aliases)
        ? character.aliases.map(String).map((alias) => alias.trim()).filter(Boolean)
        : [],
      role: String(character.role ?? ""),
      summary: String(character.summary ?? ""),
      personality: String(character.personality ?? ""),
      appearance: String(character.appearance ?? ""),
      background: String(character.background ?? ""),
      age: String(character.age ?? ""),
      goals: String(character.goals ?? ""),
      fears: String(character.fears ?? ""),
      motivations: String(character.motivations ?? ""),
      notes: String(character.notes ?? ""),
      relationships,
    }

    return {
      draft,
      message: String(
        parsed.message ??
          "The character profile is ready for your approval.",
      ),
      ready: parsed.ready !== false,
    }
  } catch {
    return null
  }
}

function characterDraftToCharacter(draft: CharacterDraft, existingRelationships: Character["relationships"] = []): Omit<Character, "id" | "createdAt" | "updatedAt"> {
  return {
    name: draft.name,
    aliases: draft.aliases,
    role: draft.role,
    summary: draft.summary,
    personality: draft.personality,
    appearance: draft.appearance,
    background: draft.background,
    age: draft.age,
    goals: draft.goals,
    fears: draft.fears,
    motivations: draft.motivations,
    relationships: existingRelationships,
    notes: draft.notes,
    contextEnabled: true,
  }
}

function convertTextToTipTapContent(text: string): JSONContent[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
  if (!normalized) return []
  return normalized.split(/\n\s*\n/g).map((paragraph) => {
    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean)
    const content: JSONContent[] = []
    lines.forEach((line, index) => {
      if (index > 0) content.push({ type: "hardBreak" })
      content.push({ type: "text", text: line })
    })
    return { type: "paragraph", content } satisfies JSONContent
  })
}

function appendTextToSceneContent(existingContent: JSONContent | undefined, text: string): JSONContent {
  const existing = existingContent ?? { type: "doc", content: [] }
  const existingArray = Array.isArray(existing.content) ? existing.content : []
  const newParagraphs = convertTextToTipTapContent(text)
  return {
    ...existing,
    type: "doc",
    content: [...existingArray, ...(existingArray.length ? [{ type: "paragraph" as const }] : []), ...newParagraphs],
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AIChatPanel() {
  const {
    project,
    activeScene,
    updateSceneContent,
    addCharacter,
    updateCharacter,
    addCharacterRelationship,
  } = useProject()

  const storageKey = useMemo(() => activeScene ? getConversationStorageKey(project, activeScene.id) : null, [project, activeScene])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextMode, setContextMode] = useState<ContextMode>("full")
  const [chatMode, setChatMode] = useState<ChatMode>("chat")
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft | null>(null)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [insertedMessageId, setInsertedMessageId] = useState<string | null>(null)
  const [createdCharacterId, setCreatedCharacterId] = useState<string | null>(null)

  const abortController = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!storageKey) {
      setMessages([])
      setContextMode("full")
      setChatMode("chat")
      setCharacterDraft(null)
      return
    }
    const stored = loadConversation(storageKey)
    setMessages(stored.messages)
    setContextMode(stored.contextMode)
    setChatMode(stored.chatMode ?? "chat")
    setCharacterDraft(stored.characterDraft ?? null)
    setError(null)
    setInput("")
    setInsertedMessageId(null)
    setCreatedCharacterId(null)
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    saveConversation(storageKey, { messages, contextMode, chatMode, characterDraft })
  }, [storageKey, messages, contextMode, chatMode, characterDraft])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, characterDraft])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [input])

  const contextLabel = contextModes.find((mode) => mode.value === contextMode)?.label ?? "Full context"

  const stopGeneration = () => {
    abortController.current?.abort()
    abortController.current = null
    setIsLoading(false)
  }

  const clearConversation = () => {
    stopGeneration()
    setMessages([])
    setError(null)
    setInput("")
    setCharacterDraft(null)
    setCreatedCharacterId(null)
  }

  const startCharacterCreation = () => {
    if (isLoading) stopGeneration()
    setChatMode("character")
    setCharacterDraft(null)
    setCreatedCharacterId(null)
    setError(null)
    setMessages((current) => current.length ? current : [{ id: newId(), role: "assistant", content: "Let's design the character together. Tell me the idea you have so far — even if it's only a name, role, personality, or a single interesting detail." }])
  }

  const exitCharacterCreation = () => {
    if (isLoading) stopGeneration()
    setChatMode("chat")
    setCharacterDraft(null)
    setCreatedCharacterId(null)
    setError(null)
  }

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1500)
    } catch {
      setError("Unable to copy the response to the clipboard.")
    }
  }

  const insertIntoScene = (message: ChatMessage) => {
    if (!activeScene || !message.content.trim()) return
    try {
      updateSceneContent(activeScene.id, appendTextToSceneContent(activeScene.content, message.content))
      setInsertedMessageId(message.id)
      window.setTimeout(() => setInsertedMessageId((current) => current === message.id ? null : current), 1800)
      setError(null)
    } catch (err) {
      console.error("Failed to insert AI response into scene:", err)
      setError("Unable to insert the AI response into the current scene.")
    }
  }

  const approveCharacter = () => {
    if (!characterDraft || !characterDraft.name.trim()) {
      setError("The character needs a name before it can be created.")
      return
    }

    try {
      // addCharacter() creates the real Mnemeona character ID and inserts
      // the base record into the project's character collection.
      const characterId = addCharacter()

      if (!characterId) {
        throw new Error("Mnemeona did not return a character ID.")
      }

      // Apply the complete AI-generated profile to that real record.
      updateCharacter(
        characterId,
        characterDraftToCharacter(characterDraft),
      )

      // Relationships must reference real existing character IDs.
      // Resolve either an ID or a character name so models that return a
      // name despite the prompt still work correctly.
      for (const relationship of characterDraft.relationships) {
        const rawTarget = relationship.targetCharacterId.trim()
        if (!rawTarget) continue

        const target = project.characters.find(
          (character) =>
            character.id === rawTarget ||
            character.name.trim().toLowerCase() === rawTarget.toLowerCase(),
        )

        if (!target) {
          console.warn(
            "Skipping AI character relationship because the target character was not found:",
            rawTarget,
          )
          continue
        }

        addCharacterRelationship(
          characterId,
          target.id,
          relationship.type,
          relationship.description,
        )
      }

      setCreatedCharacterId(characterId)
      setCharacterDraft(null)
      setError(null)

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: `Character "${characterDraft.name}" has been added to the project.`,
        },
      ])
    } catch (err) {
      console.error("Failed to create AI character:", err)
      setError(
        err instanceof Error
          ? `Unable to create the character: ${err.message}`
          : "Unable to create the character in the project.",
      )
    }
  }

  const updateDraftField = (field: keyof CharacterDraft, value: CharacterDraft[keyof CharacterDraft]) => {
    setCharacterDraft((current) => current ? { ...current, [field]: value } : current)
  }

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading || !activeScene) return

    setError(null)
    setInput("")

    const userMessage: ChatMessage = { id: newId(), role: "user", content: text }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsLoading(true)

    const controller = new AbortController()
    abortController.current = controller

    try {
      const aiMessages: AIMessage[] = nextMessages.map((message) => ({ role: message.role, content: message.content }))
      const systemPrompt = chatMode === "character"
        ? buildCharacterSystemPrompt(project, activeScene, characterDraft)
        : buildPromptForContextMode(contextMode, project, activeScene)

      let response = ""
      response = await streamAIChat({
        messages: aiMessages,
        project,
        activeScene,
        signal: controller.signal,
        systemPrompt,
        onToken: (token) => { response += token },
      })

      if (!response.trim()) response = "The AI returned an empty response."

      if (chatMode === "character") {
        const parsed = tryParseCharacterDraft(response)
        if (parsed) {
          setCharacterDraft(parsed.draft)
          setMessages((current) => [...current, {
            id: newId(),
            role: "assistant",
            content: parsed.message,
          }])
        } else {
          setMessages((current) => [...current, { id: newId(), role: "assistant", content: response }])
        }
      } else {
        setMessages((current) => [...current, { id: newId(), role: "assistant", content: response }])
      }
    } catch (err) {
      if (controller.signal.aborted) return
      console.error("AI chat failed:", err)
      setError(err instanceof Error ? err.message : "AI chat failed.")
    } finally {
      if (abortController.current === controller) abortController.current = null
      setIsLoading(false)
    }
  }

  const renderCharacterDraft = () => {
    if (!characterDraft) return null
    const fields: { key: keyof CharacterDraft; label: string; multiline?: boolean }[] = [
      { key: "name", label: "Name" },
      { key: "aliases", label: "Aliases" },
      { key: "role", label: "Role" },
      { key: "age", label: "Age" },
      { key: "summary", label: "Summary", multiline: true },
      { key: "personality", label: "Personality", multiline: true },
      { key: "appearance", label: "Appearance", multiline: true },
      { key: "background", label: "Background", multiline: true },
      { key: "goals", label: "Goals", multiline: true },
      { key: "fears", label: "Fears", multiline: true },
      { key: "motivations", label: "Motivations", multiline: true },
      { key: "notes", label: "Notes", multiline: true },
    ]

    return <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">Character Profile Ready</div>
          <div className="text-xs text-muted-foreground">Review the profile before anything is added to your project.</div>
        </div>
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        {fields.map(({ key, label, multiline }) => {
          const value = key === "aliases" ? characterDraft.aliases.join(", ") : String(characterDraft[key] ?? "")
          return <label key={String(key)} className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            {multiline ? <textarea value={value} onChange={(event) => updateDraftField(key, key === "aliases" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value)} className="h-16 max-h-24 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" /> : <input value={value} onChange={(event) => updateDraftField(key, key === "aliases" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />}
          </label>
        })}
      </div>
      {characterDraft.relationships.length > 0 && <div className="rounded-md border border-border p-2 text-sm">
        <div className="mb-1 font-medium">Relationships</div>
        {characterDraft.relationships.map((relationship, index) => {
          const target = project.characters.find((character) => character.id === relationship.targetCharacterId)
          return <div key={`${relationship.targetCharacterId}-${index}`} className="text-muted-foreground">{target?.name ?? relationship.targetCharacterId}: {relationship.type}{relationship.description ? ` — ${relationship.description}` : ""}</div>
        })}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={approveCharacter}><Check className="mr-1 h-4 w-4" />Approve & Create Character</Button>
        <Button size="sm" variant="outline" onClick={() => setCharacterDraft(null)}>Discard Draft</Button>
      </div>
    </div>
  }

  return <div className="flex h-full min-h-0 w-[360px] max-w-[90vw] shrink-0 flex-col overflow-hidden border-l bg-background">
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Bot className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">AI Chat</div>
          <div className="truncate text-[11px] text-muted-foreground">{chatMode === "character" ? "Character creation" : contextLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {chatMode === "character" ? <Button size="sm" variant="ghost" onClick={exitCharacterCreation} title="Exit character creation"><X className="h-4 w-4" /></Button> : <Button size="sm" variant="ghost" onClick={startCharacterCreation} title="Create character"><User className="h-4 w-4" /></Button>}
        <Button size="sm" variant="ghost" onClick={clearConversation} title="Clear conversation"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>

    {chatMode === "chat" && <div className="shrink-0 border-b px-2 py-1.5">
      <div className="flex flex-wrap gap-1">
        {aiActions.map((action) => { const Icon = action.icon; return <Button key={action.label} size="sm" variant="outline" disabled={isLoading || !activeScene} onClick={() => void sendMessage(action.prompt)}><Icon className="mr-1 h-3.5 w-3.5" />{action.label}</Button> })}
        <Button size="sm" variant="outline" onClick={startCharacterCreation}><Plus className="mr-1 h-3.5 w-3.5" />Create character</Button>
      </div>
    </div>}

    {chatMode === "chat" && <div className="relative shrink-0 border-b px-3 py-1.5">
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowContextMenu((value) => !value)}><Settings2 className="mr-1 h-3.5 w-3.5" />{contextLabel}<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
      {showContextMenu && <div className="absolute left-3 top-9 z-20 w-64 rounded-md border bg-popover p-1 shadow-md">
        {contextModes.map((mode) => <button key={mode.value} type="button" className={`block w-full rounded px-2 py-2 text-left text-xs hover:bg-muted ${contextMode === mode.value ? "bg-muted" : ""}`} onClick={() => { setContextMode(mode.value); setShowContextMenu(false) }}><div className="font-medium">{mode.label}</div><div className="text-muted-foreground">{mode.description}</div></button>)}
      </div>}
    </div>}

    <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2.5">
      {messages.length === 0 && chatMode === "chat" && <div className="py-10 text-center text-sm text-muted-foreground">Ask Mnemeona AI about your story, characters, scenes, or prose.</div>}
      {messages.map((message) => <div key={message.id} className={`group flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        {message.role === "assistant" && <div className="mt-1 rounded-full bg-muted p-1.5"><Bot className="h-3.5 w-3.5" /></div>}
        <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {message.content}
          {message.role === "assistant" && <div className="mt-2 flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => void copyMessage(message)}>{copiedMessageId === message.id ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}</Button>
            {chatMode === "chat" && activeScene && <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => insertIntoScene(message)}>{insertedMessageId === message.id ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}</Button>}
          </div>}
        </div>
        {message.role === "user" && <div className="mt-1 rounded-full bg-muted p-1.5"><User className="h-3.5 w-3.5" /></div>}
      </div>)}
      {characterDraft && renderCharacterDraft()}
      {createdCharacterId && <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" />Character created successfully.</div><div className="mt-1 text-xs text-muted-foreground">The character is now part of your project and can be used by Mnemeona's character context and detection systems.</div></div>}
      {isLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Thinking…</div>}
      <div ref={messagesEndRef} />
    </div>

    {error && <div className="mx-3 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

    <div className="shrink-0 border-t p-2">
      <div className="flex items-end gap-2">
        <textarea ref={textareaRef} value={input} disabled={isLoading || !activeScene} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder={chatMode === "character" ? "Describe your character idea…" : "Ask Mnemeona AI…"} className="max-h-[120px] min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
        {isLoading ? <Button size="icon" variant="outline" onClick={stopGeneration} title="Stop generation"><Square className="h-4 w-4" /></Button> : <Button size="icon" onClick={() => void sendMessage()} disabled={!input.trim() || !activeScene} title="Send"><Send className="h-4 w-4" /></Button>}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line</div>
    </div>
  </div>
}
