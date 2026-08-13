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

import {
  useAITokenCount,
} from "./components/ai/aiservice/useAITokenCount"

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
   * Keep the response-token setting in App as well as
   * AIContextPanel so the token calculation can continue
   * even when the panel is closed.
   */
  const [
    continueWritingLength,
    setContinueWritingLength,
  ] = useState(
    loadContinueWritingLength(),
  )

  /*
   * The token calculation is deliberately mounted here,
   * rather than inside AIContextPanel.
   *
   * Therefore:
   *
   *   Open panel
   *       ↓
   *   token calculation starts
   *       ↓
   *   close panel
   *       ↓
   *   calculation CONTINUES
   *
   * App remains mounted for the whole application lifetime.
   */
  const {
    isCalculating:
      isTokenCountCalculating,
    isApproximate:
      isTokenCountApproximate,
  } = useAITokenCount({
    project,
    activeScene,
    responseTokens:
      continueWritingLength,
  })

  /*
   * If the response length is changed from AIContextPanel,
   * keep App's copy synchronized.
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
                  className={`relative gap-2 overflow-hidden transition-all duration-300 ${
                    isTokenCountCalculating
                      ? "bg-primary/10 text-primary"
                      : ""
                  }`}
                  onClick={() =>
                    setShowAIContext(
                      true,
                    )
                  }
                  disabled={
                    summaryGenerating
                  }
                  aria-label={
                    isTokenCountCalculating
                      ? "AI Context is calculating token usage"
                      : "Open AI Context"
                  }
                  title={
                    isTokenCountCalculating
                      ? "Calculating AI context tokens…"
                      : "AI Context"
                  }
                >
                  {/* Animated background sweep */}

                  {isTokenCountCalculating && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full animate-[aiContextSweep_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                    />
                  )}

                  <span className="relative flex items-center gap-2">
                    <Sparkles
                      className={`size-4 transition-all duration-300 ${
                        isTokenCountCalculating
                          ? "animate-[aiContextSparkle_1.4s_ease-in-out_infinite] text-primary"
                          : ""
                      }`}
                    />

                    AI Context

                    {isTokenCountCalculating && (
                      <span
                        aria-hidden="true"
                        className="flex items-center gap-0.5"
                      >
                        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />

                        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />

                        <span className="size-1 animate-bounce rounded-full bg-primary" />
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
            onClick={() =>
              setShowAIContext(
                false,
              )
            }
          />

          <div className="relative z-10 flex h-[85vh] w-[min(1100px,90vw)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-5">
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-8 items-center justify-center rounded-lg transition-all duration-300 ${
                    isTokenCountCalculating
                      ? "bg-primary/15"
                      : "bg-primary/10"
                  }`}
                >
                  <Sparkles
                    className={`size-4 text-primary ${
                      isTokenCountCalculating
                        ? "animate-[aiContextSparkle_1.4s_ease-in-out_infinite]"
                        : ""
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    AI Context

                    {isTokenCountCalculating && (
                      <span className="flex items-center gap-0.5">
                        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />

                        <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />

                        <span className="size-1 animate-bounce rounded-full bg-primary" />
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    {isTokenCountCalculating
                      ? "Calculating token usage…"
                      : "Context available to Mnemeona AI"}
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
              >
                <X className="size-4" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <AIContextPanel />
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
              transform: translateX(-100%);
            }

            100% {
              transform: translateX(200%);
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
