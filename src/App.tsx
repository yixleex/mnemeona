import { useEffect, useState } from "react"

import {
  Search,
  Sparkles,
  Users,
  Globe2,
  StickyNote,
  Settings,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { NovelEditor } from "@/components/editor/NovelEditor"
import { ProjectSwitcher } from "./components/project/ProjectSwitcher"
import { ManuscriptTree } from "./components/manuscript/ManuscriptTree"
import { CharacterDatabase } from "./components/characters/CharacterDatabase"
import { CharacterRelationships } from "./components/characters/CharacterRelationships"
import { WorldDatabase } from "./components/world/WorldDatabase"
import { AIChatPanel } from "./components/ai/aichatpanel/AIChatPanel"
import { AIContextPanel } from "./components/ai/aicontextpanel/AIContextPanel"
import { AISettingsDialog } from "./components/ai/aisettingsdialog/AISettingsDialog"
import { useProject } from "./context/ProjectContext"

import {
  loadContinueWritingLength,
} from "./components/ai/aiservice/aiService"

type Workspace =
  | "manuscript"
  | "characters"
  | "world"

type CharacterView =
  | "database"
  | "relationships"

export default function App() {
  const {
    project,
    activeScene,
    projectWordCount,
    activeSceneWordCount,
    summaryGenerating,
  } = useProject()

  const [
    workspace,
    setWorkspace,
  ] = useState<Workspace>(
    "manuscript",
  )

  const [
    characterView,
    setCharacterView,
  ] = useState<CharacterView>(
    "database",
  )

  const [
    showAIContext,
    setShowAIContext,
  ] = useState(false)

  const [
    showAISettings,
    setShowAISettings,
  ] = useState(false)

  /*
   * Tracks whether the AI Context token counter is currently
   * waiting for Ollama.
   *
   * AIContextPanel owns the actual calculation. This state is
   * only used so App can animate the button that opens the panel.
   */
  const [
    isTokenCountCalculating,
    setIsTokenCountCalculating,
  ] = useState(false)

  /*
   * Keep the response-token setting in App as well as
   * AIContextPanel so the setting remains synchronized
   * while the application is mounted.
   *
   * IMPORTANT:
   * App does not mount useAITokenCount.
   *
   * Token counting must not be part of the application's
   * initial render/boot path. AIContextPanel is responsible
   * for requesting token calculations when the AI Context
   * interface is actually opened.
   */
  const [
    continueWritingLength,
    setContinueWritingLength,
  ] = useState(
    loadContinueWritingLength(),
  )

  /*
   * Keep App's copy synchronized when the response length
   * is changed from AIContextPanel.
   *
   * The storage event does not fire in the same tab, so the
   * custom event lets the two components communicate locally.
   */
  useEffect(() => {
    const handleLengthChange =
      () => {
        setContinueWritingLength(
          loadContinueWritingLength(),
        )
      }

    window.addEventListener(
      "mnemeona:continue-writing-length-changed",
      handleLengthChange,
    )

    return () => {
      window.removeEventListener(
        "mnemeona:continue-writing-length-changed",
        handleLengthChange,
      )
    }
  }, [])

  /*
   * Keep the variable intentionally referenced so that the
   * response-token setting remains part of App's state and
   * synchronization lifecycle.
   *
   * Token counting itself is deliberately not performed here.
   */
  void continueWritingLength
  void project

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* -------------------------------------------------- */}
      {/* Manuscript Sidebar */}
      {/* -------------------------------------------------- */}

      <aside className="flex w-64 shrink-0 flex-col border-r">
        {/* Header */}

        <header className="flex h-14 items-center border-b px-3">
          <ProjectSwitcher />

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-8"
            onClick={() =>
              setShowAISettings(true)
            }
            aria-label="AI Settings"
            title="AI Settings"
          >
            <Settings className="size-4" />
          </Button>
        </header>

        {/* Search */}
        <div className="px-3 pb-2 pt-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <Search className="size-4" />

            Search

            <span className="ml-auto text-xs opacity-50">
              ⌘K
            </span>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ManuscriptTree
            active={
              workspace ===
              "manuscript"
            }
            onSceneSelect={() =>
              setWorkspace(
                "manuscript",
              )
            }
          />

          {/* Story */}

          <div className="mb-2 mt-8 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Story
          </div>

          <div className="space-y-1">
            {/* Characters */}
            <Button
              variant={
                workspace ===
                "characters"
                  ? "secondary"
                  : "ghost"
              }
              className={`w-full justify-start gap-2 ${
                workspace ===
                "characters"
                  ? ""
                  : "text-muted-foreground"
              }`}
              onClick={() => {
                setWorkspace(
                  "characters",
                )

                setCharacterView(
                  "database",
                )
              }}
            >
              <Users className="size-4" />

              Characters
            </Button>

            {/* World */}
            <Button
              variant={
                workspace ===
                "world"
                  ? "secondary"
                  : "ghost"
              }
              className={`w-full justify-start gap-2 ${
                workspace ===
                "world"
                  ? ""
                  : "text-muted-foreground"
              }`}
              onClick={() => {
                setWorkspace(
                  "world",
                )
              }}
            >
              <Globe2 className="size-4" />

              World
            </Button>

            {/* Notes */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground"
            >
              <StickyNote className="size-4" />

              Notes
            </Button>
          </div>
        </nav>

        {/* Word Count */}
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {projectWordCount.toLocaleString()}{" "}
            words
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------- */}
      {/* Main Workspace */}
      {/* -------------------------------------------------- */}

      <main className="flex min-w-0 flex-1 flex-col">
        {workspace ===
        "world" ? (
          <WorldDatabase
            onClose={() =>
              setWorkspace(
                "manuscript",
              )
            }
          />
        ) : workspace ===
          "characters" ? (
          characterView ===
          "database" ? (
            <CharacterDatabase
              onOpenRelationships={() =>
                setCharacterView(
                  "relationships",
                )
              }
            />
          ) : (
            <CharacterRelationships
              onBack={() =>
                setCharacterView(
                  "database",
                )
              }
            />
          )
        ) : (
          <>
            {/* Editor Header */}
            <header className="flex h-14 shrink-0 items-center border-b px-6">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {activeScene?.title ??
                    "No scene selected"}
                </div>

                {activeScene?.pov && (
                  <div className="text-[11px] text-muted-foreground">
                    {activeScene.pov}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="mr-2 text-xs text-muted-foreground">
                  Saved
                </span>

                {/* -------------------------------------------------- */}
                {/* AI Context */}
                {/* -------------------------------------------------- */}

                <Button
                  variant="ghost"
                  size="sm"
                  className="relative gap-2 overflow-hidden transition-all duration-300"
                  onClick={() =>
                    setShowAIContext(
                      true,
                    )
                  }
                  disabled={
                    summaryGenerating
                  }
                  aria-label="Open AI Context"
                  title={
                    isTokenCountCalculating
                      ? "AI Context — calculating tokens"
                      : "AI Context"
                  }
                >
                  {/*
                   * Animated sweep shown only while Ollama is
                   * calculating the AI Context token count.
                   *
                   * pointer-events-none ensures the overlay never
                   * interferes with clicking the button.
                   */}
                  {isTokenCountCalculating && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
                    >
                      <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full animate-[aiContextSweep_1.25s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
                    </span>
                  )}

                  <span className="relative z-10 flex items-center gap-2">
                    <Sparkles
                      className={`size-4 ${
                        isTokenCountCalculating
                          ? "animate-[aiContextSparkle_1.1s_ease-in-out_infinite]"
                          : ""
                      }`}
                    />

                    AI Context

                    {isTokenCountCalculating && (
                      <span className="text-[10px] font-medium text-primary/80">
                        …
                      </span>
                    )}
                  </span>
                </Button>

                {/* -------------------------------------------------- */}
                {/* AI Continue Writing */}
                {/* -------------------------------------------------- */}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    window.dispatchEvent(
                      new Event(
                        "mnemeona:ai-continue",
                      ),
                    )
                  }}
                  disabled={
                    !activeScene ||
                    summaryGenerating
                  }
                  title="Continue writing with AI"
                >
                  <Sparkles className="size-4" />
                </Button>
              </div>
            </header>

            {/* Editor */}

            <div className="min-h-0 flex-1">
              <NovelEditor />
            </div>

            {/* Editor Footer */}

            <footer className="flex h-9 shrink-0 items-center border-t px-6 text-xs text-muted-foreground">
              <span>
                {activeScene?.title ??
                  "No scene selected"}
              </span>

              {activeScene && (
                <>
                  <span className="mx-2">
                    ·
                  </span>

                  <span>
                    {activeSceneWordCount.toLocaleString()}{" "}
                    words
                  </span>
                </>
              )}

              <span className="ml-auto">
                Saved just now
              </span>
            </footer>
          </>
        )}
      </main>

      {/* -------------------------------------------------- */}
      {/* AI Chat Sidebar */}
      {/* -------------------------------------------------- */}

      <AIChatPanel />

      {/* -------------------------------------------------- */}
      {/* AI Context Modal */}
      {/* -------------------------------------------------- */}

      {showAIContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close AI Context"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowAIContext(
                false,
              )
            }}
          />

          <div className="relative z-10 flex h-[85vh] w-[min(1100px,90vw)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="size-4 text-primary" />
                </div>

                <div>
                  <div className="text-sm font-medium">
                    AI Context
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    Context available to Mnemeona AI
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setShowAIContext(
                    false,
                  )
                }
                aria-label="Close AI Context"
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <AIContextPanel
                onTokenCalculationChange={
                  setIsTokenCountCalculating
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* AI Settings Modal */}
      {/* -------------------------------------------------- */}

      <AISettingsDialog
        open={
          showAISettings
        }
        onOpenChange={
          setShowAISettings
        }
      />

      {/* -------------------------------------------------- */}
      {/* Story Summary Generation Modal */}
      {/* -------------------------------------------------- */}

      {summaryGenerating && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Updating story summary"
            className="relative z-10 w-[min(420px,90vw)] rounded-2xl border bg-background p-6 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center">
              {/* Spinner */}
              <div className="mb-5 flex size-12 items-center justify-center rounded-full border-2 border-muted border-t-primary animate-spin">
                <Sparkles className="size-5 text-primary" />
              </div>

              <h2 className="text-base font-medium">
                Updating story summary
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Mnemeona AI is reviewing the story so far
                and updating its continuity summary.
              </p>

              <p className="mt-3 text-xs text-muted-foreground">
                Please wait while this finishes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* AI Context Animations */}
      {/* -------------------------------------------------- */}

      <style>
        {`
          @keyframes aiContextSweep {
            0% {
              transform: translateX(-120%);
            }

            100% {
              transform: translateX(420%);
            }
          }

          @keyframes aiContextSparkle {
            0%,
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 0.7;
            }

            50% {
              transform: scale(1.18) rotate(8deg);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  )
}
