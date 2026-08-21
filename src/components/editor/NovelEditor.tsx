import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  EditorContent,
  useEditor,
} from "@tiptap/react"

import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"

import {
  Loader2,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"

import { useProject } from "@/context/ProjectContext"

import { EditorToolbar } from "./EditorToolbar"
import { AITextMark } from "./AITextMark"
import { AIDirector } from "./AIDirector"

import {
  loadContinueWritingLength,
  streamAIChat,
} from "@/components/ai/aiservice/aiService"

import "./NovelEditor.css"

export function NovelEditor() {
  const {
    project,
    activeScene,
    updateSceneContent,
  } = useProject()

  const [
    aiGenerating,
    setAIGenerating,
  ] = useState(false)

  /*
   * The AbortController belongs to the current
   * AI generation.
   *
   * It is shared by Continue AI and AI Director so
   * both can be stopped using the same cancellation
   * mechanism.
   */
  const continueAbortController =
    useRef<AbortController | null>(null)

  /*
   * Identifies an active AI Director request.
   *
   * Continue AI does not need a request ID because
   * it is controlled directly by the existing UI.
   */
  const directorRequestId =
    useRef<string | null>(null)

  const editor =
    useEditor({
      extensions: [
        StarterKit,
        Underline,
        AITextMark,

        Placeholder.configure({
          emptyEditorClass:
            "is-editor-empty",
        }),
      ],

      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
          },
        ],
      },

      editorProps: {
        attributes: {
          class: "focus:outline-none",
        },
      },
    })

  // --------------------------------------------------
  // Keep editor editable state synchronized
  // --------------------------------------------------

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(
      !aiGenerating,
    )
  }, [
    editor,
    aiGenerating,
  ])

  // --------------------------------------------------
  // Load scene
  // --------------------------------------------------

  useEffect(() => {
    if (!editor) {
      return
    }

    /*
     * If a generation is running and the user switches
     * scenes, cancel the generation before loading the
     * new scene.
     */
    continueAbortController.current?.abort()
    continueAbortController.current = null

    directorRequestId.current = null

    setAIGenerating(false)

    if (!activeScene) {
      editor.commands.clearContent()
      return
    }

    editor.commands.setContent(
      activeScene.content,
      {
        emitUpdate: false,
      },
    )

    editor.commands.focus(
      "start",
    )
  }, [
    editor,
    activeScene?.id,
  ])

  // --------------------------------------------------
  // Cancel generation when editor unmounts
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      continueAbortController.current?.abort()
      continueAbortController.current = null
      directorRequestId.current = null
    }
  }, [])

  // --------------------------------------------------
  // Save editor changes
  // --------------------------------------------------

  useEffect(() => {
    if (
      !editor ||
      !activeScene
    ) {
      return
    }

    const sceneId =
      activeScene.id

    const handleUpdate = () => {
      /*
       * Never save normal editor updates while AI
       * generation is controlling the document.
       *
       * Continue AI and AI Director explicitly save
       * their generated document.
       */
      if (aiGenerating) {
        return
      }

      updateSceneContent(
        sceneId,
        editor.getJSON(),
      )
    }

    editor.on(
      "update",
      handleUpdate,
    )

    return () => {
      editor.off(
        "update",
        handleUpdate,
      )
    }
  }, [
    editor,
    activeScene?.id,
    updateSceneContent,
    aiGenerating,
  ])

  // --------------------------------------------------
  // Stop AI generation
  // --------------------------------------------------

  const stopAIContinue = () => {
    const controller =
      continueAbortController.current

    if (!controller) {
      return
    }

    controller.abort()
  }

  // --------------------------------------------------
  // AI Continue Writing
  // --------------------------------------------------

  useEffect(() => {
    if (!editor) {
      return
    }

    const handleAIContinue =
      async () => {
        if (
          !activeScene ||
          aiGenerating
        ) {
          return
        }

        /*
         * Create a fresh AbortController for this
         * specific generation.
         */
        const controller =
          new AbortController()

        continueAbortController.current =
          controller

        directorRequestId.current =
          null

        setAIGenerating(
          true,
        )

        /*
         * Read the current response-length setting
         * at the exact moment Continue AI is pressed.
         */
        const continueWritingTokens =
          loadContinueWritingLength()

        /*
         * Read the current scene-specific context.
         */
        const sceneAIContext =
          activeScene.aiAdditionalContext
            ?.trim() ?? ""

        /*
         * Continue must ALWAYS start from the actual
         * end of the document.
         */
        const documentEnd =
          editor.state.doc.content.size

        /*
         * Get the actual text currently in the scene.
         */
        const existingText =
          editor.state.doc.textBetween(
            0,
            documentEnd,
            "\n",
          )

        const messages = [
          {
            role: "user" as const,

            content: `Continue writing the current scene from the EXACT END of the author's existing text.

The author's current scene is:

${existingText}

Continue naturally from the final sentence and final word above.

IMPORTANT:
- Write ONLY new continuation prose.
- Do not explain what you are doing.
- Do not repeat any existing text.
- Do not restart or rewrite the scene.
- Continue directly from the end of the existing manuscript.
- Maintain the current POV, tense, tone, characters, setting, pacing, and narrative style.
- Treat the supplied manuscript as existing text that must not be repeated.
- The requested response length is ${continueWritingTokens} tokens.
- Use the available response length to produce a substantial continuation.
- Do not intentionally make the response short.
- Do not summarize the continuation.
- Output only the new prose.${
              sceneAIContext
                ? `

ADDITIONAL SCENE-SPECIFIC AUTHOR INSTRUCTIONS:

${sceneAIContext}`
                : ""
            }`,
          },
        ]

        /*
         * This position is deliberately initialized
         * to the TRUE end of the document.
         */
        let insertionPosition =
          documentEnd

        try {
          /*
           * Put the cursor at the actual end of the
           * manuscript before streaming begins.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              insertionPosition,
            )
            .setMark("aiText")
            .run()

          /*
           * Start the streaming generation.
           *
           * The AbortSignal connects the Stop AI
           * button to the actual fetch/stream.
           */
          await streamAIChat({
            messages,
            project,
            activeScene,
            continueWritingTokens,

            signal:
              controller.signal,

            onToken: (
              token,
            ) => {
              /*
               * Ignore any token that somehow arrives
               * after the user pressed Stop.
               */
              if (
                controller.signal.aborted ||
                !token
              ) {
                return
              }

              /*
               * Always insert at the explicit insertion
               * position rather than the author's cursor.
               */
              const result =
                editor
                  .chain()
                  .focus()
                  .setTextSelection(
                    insertionPosition,
                  )
                  .setMark("aiText")
                  .insertContent(
                    token,
                  )
                  .run()

              if (!result) {
                return
              }

              /*
               * Re-read the editor's current document
               * position after insertion.
               */
              insertionPosition =
                editor.state.selection.from
            },
          })

          /*
           * Normal completion.
           *
           * Remove the AI mark and save the completed
           * document.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              Math.min(
                insertionPosition,
                editor.state.doc.content.size,
              ),
            )
            .unsetMark("aiText")
            .run()

          updateSceneContent(
            activeScene.id,
            editor.getJSON(),
          )
        } catch (error) {
          /*
           * Abort is an intentional user action.
           * Do not report it as an AI failure.
           */
          const wasAborted =
            controller.signal.aborted ||
            (
              error instanceof DOMException &&
              error.name ===
                "AbortError"
            )

          if (!wasAborted) {
            console.error(
              "AI continue writing failed:",
              error,
            )
          }

          /*
           * Always clean up the AI mark.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              Math.min(
                insertionPosition,
                editor.state.doc.content.size,
              ),
            )
            .unsetMark("aiText")
            .run()

          /*
           * IMPORTANT:
           *
           * If Stop was pressed, keep everything the
           * AI managed to generate before cancellation.
           */
          updateSceneContent(
            activeScene.id,
            editor.getJSON(),
          )
        } finally {
          /*
           * Only clear the controller if this is still
           * the active generation.
           */
          if (
            continueAbortController.current ===
            controller
          ) {
            continueAbortController.current =
              null
          }

          setAIGenerating(
            false,
          )
        }
      }

    window.addEventListener(
      "mnemeona:ai-continue",
      handleAIContinue,
    )

    return () => {
      window.removeEventListener(
        "mnemeona:ai-continue",
        handleAIContinue,
      )
    }
  }, [
    editor,
    activeScene,
    project,
    aiGenerating,
    updateSceneContent,
  ])

  // --------------------------------------------------
  // AI Director
  // --------------------------------------------------

  useEffect(() => {
    if (!editor) {
      return
    }

    const handleDirectorRequest =
      async (
        event: Event,
      ) => {
        const customEvent =
          event as CustomEvent<{
            requestId: string
            instruction: string
          }>

        const {
          requestId,
          instruction,
        } =
          customEvent.detail ?? {}

        if (
          !requestId ||
          !instruction?.trim() ||
          !activeScene ||
          aiGenerating
        ) {
          return
        }

        /*
         * Create a dedicated controller for the
         * AI Director generation.
         */
        const controller =
          new AbortController()

        continueAbortController.current =
          controller

        directorRequestId.current =
          requestId

        setAIGenerating(
          true,
        )

        /*
         * The Director always starts at the actual
         * end of the current manuscript.
         */
        const documentEnd =
          editor.state.doc.content.size

        /*
         * Read the current scene text so the AI can
         * understand exactly where it needs to continue.
         */
        const existingText =
          editor.state.doc.textBetween(
            0,
            documentEnd,
            "\n",
          )

        /*
         * Read scene-specific AI instructions.
         */
        const sceneAIContext =
          activeScene.aiAdditionalContext
            ?.trim() ?? ""

        /*
         * Use the same Continue Writing length setting
         * for the Director.
         */
        const continueWritingTokens =
          loadContinueWritingLength()

        const directorPrompt =
          `Continue writing the current scene from the EXACT END of the author's existing text.

The author is directing what should happen next.

AUTHOR'S DIRECTION:

${instruction.trim()}

CURRENT SCENE:

${existingText}

IMPORTANT RULES:
- Continue directly from the final word of the existing scene.
- Write ONLY the new continuation prose.
- Do not repeat any existing text.
- Do not rewrite the existing scene.
- Do not restart the scene.
- Follow the author's direction above.
- Maintain the established characters, POV, tense, setting, tone, style, pacing, and continuity.
- Treat the author's direction as instructions about what should happen in the continuation.
- Make the requested direction feel natural rather than forcing it awkwardly into the prose.
- Do not explain your choices.
- Do not mention that you are an AI.
- Do not summarize what happens.
- Do not output notes, commentary, headings, or analysis.
- Output only manuscript prose.
- If the author's direction is ambiguous, make the most natural interpretation that fits the established story.
- Do not contradict established story facts.
- The requested response length is ${continueWritingTokens} tokens.
- Use the available response length to produce a substantial continuation.
- Do not intentionally make the response short.${
            sceneAIContext
              ? `

ADDITIONAL SCENE-SPECIFIC AUTHOR INSTRUCTIONS:

${sceneAIContext}`
              : ""
          }`

        let insertionPosition =
          documentEnd

        let generatedText =
          ""

        try {
          /*
           * Put the insertion point at the TRUE end
           * of the manuscript.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              insertionPosition,
            )
            .setMark("aiText")
            .run()

          await streamAIChat({
            messages: [
              {
                role: "user",
                content:
                  directorPrompt,
              },
            ],

            project,
            activeScene,
            continueWritingTokens,

            signal:
              controller.signal,

            onToken: (
              token,
            ) => {
              /*
               * Ignore anything arriving after Stop.
               */
              if (
                controller.signal.aborted ||
                !token
              ) {
                return
              }

              /*
               * Keep a copy for the Director chat
               * response.
               */
              generatedText +=
                token

              /*
               * Insert the generated token exactly
               * where the previous token ended.
               */
              const result =
                editor
                  .chain()
                  .focus()
                  .setTextSelection(
                    insertionPosition,
                  )
                  .setMark("aiText")
                  .insertContent(
                    token,
                  )
                  .run()

              if (!result) {
                return
              }

              /*
               * Move the insertion point forward after
               * every streamed token.
               */
              insertionPosition =
                editor.state.selection.from
            },
          })

          /*
           * Remove the AI visual mark after successful
           * generation.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              Math.min(
                insertionPosition,
                editor.state.doc.content.size,
              ),
            )
            .unsetMark("aiText")
            .run()

          /*
           * Save the newly generated manuscript.
           */
          updateSceneContent(
            activeScene.id,
            editor.getJSON(),
          )

          /*
           * Tell the AI Director UI that generation
           * finished successfully.
           */
          window.dispatchEvent(
            new CustomEvent(
              "mnemeona:ai-director-result",
              {
                detail: {
                  requestId,
                  text:
                    generatedText,
                },
              },
            ),
          )
        } catch (error) {
          /*
           * Aborting is expected when the user presses
           * Stop AI.
           */
          const wasAborted =
            controller.signal.aborted ||
            (
              error instanceof DOMException &&
              error.name ===
                "AbortError"
            )

          if (!wasAborted) {
            console.error(
              "AI Director generation failed:",
              error,
            )
          }

          /*
           * Always remove the AI mark.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              Math.min(
                insertionPosition,
                editor.state.doc.content.size,
              ),
            )
            .unsetMark("aiText")
            .run()

          /*
           * Preserve any prose that was successfully
           * generated before the error/cancellation.
           */
          updateSceneContent(
            activeScene.id,
            editor.getJSON(),
          )

          /*
           * Send the result back to the Director UI.
           */
          window.dispatchEvent(
            new CustomEvent(
              "mnemeona:ai-director-result",
              {
                detail: {
                  requestId,
                  text:
                    generatedText,
                  error:
                    wasAborted
                      ? undefined
                      : (
                          error instanceof Error &&
                          error.message
                        )
                        ? error.message
                        : "AI generation failed.",
                  aborted:
                    wasAborted,
                },
              },
            ),
          )
        } finally {
          /*
           * Only clear the controller if this is still
           * the generation that owns it.
           */
          if (
            continueAbortController.current ===
            controller
          ) {
            continueAbortController.current =
              null
          }

          if (
            directorRequestId.current ===
            requestId
          ) {
            directorRequestId.current =
              null
          }

          setAIGenerating(
            false,
          )
        }
      }

    const handleDirectorStop =
      () => {
        /*
         * Only stop when an actual Director request
         * is active.
         */
        if (
          directorRequestId.current
        ) {
          continueAbortController.current?.abort()
        }
      }

    window.addEventListener(
      "mnemeona:ai-director",
      handleDirectorRequest,
    )

    window.addEventListener(
      "mnemeona:ai-director-stop",
      handleDirectorStop,
    )

    return () => {
      window.removeEventListener(
        "mnemeona:ai-director",
        handleDirectorRequest,
      )

      window.removeEventListener(
        "mnemeona:ai-director-stop",
        handleDirectorStop,
      )
    }
  }, [
    editor,
    activeScene,
    project,
    aiGenerating,
    updateSceneContent,
  ])

  if (!editor) {
    return null
  }

  return (
    <div className="mnemeona-editor-shell">

      {/* -------------------------------------------------- */}
      {/* AI Generation Indicator */}
      {/* -------------------------------------------------- */}

      {aiGenerating && (
        <div className="flex h-11 shrink-0 items-center gap-3 border-b bg-primary/5 px-4 text-xs text-primary">

          <Loader2 className="size-3.5 shrink-0 animate-spin" />

          <span className="min-w-0 truncate">
            Mnemeona AI is continuing your scene...
          </span>

          <span className="ml-auto hidden text-muted-foreground sm:inline">
            Editing temporarily disabled
          </span>

          {/* Stop AI */}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={
              stopAIContinue
            }
            title="Stop AI generation"
            aria-label="Stop AI generation"
          >
            <Square className="size-3 fill-current" />

            Stop AI
          </Button>

        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* Toolbar */}
      {/* -------------------------------------------------- */}

      <div
        className={
          aiGenerating
            ? "pointer-events-none opacity-60"
            : undefined
        }
      >
        <EditorToolbar
          editor={editor}
        />
      </div>

      {/* -------------------------------------------------- */}
      {/* Editor */}
      {/* -------------------------------------------------- */}

      <div className="mnemeona-editor-scroll">
        <div
          className={
            aiGenerating
              ? "mnemeona-editor opacity-80"
              : "mnemeona-editor"
          }
        >
          <EditorContent
            editor={editor}
          />
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* AI Director */}
      {/* -------------------------------------------------- */}

      <AIDirector />

    </div>
  )
}
