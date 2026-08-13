import { useEffect, useState } from "react"

import {
  EditorContent,
  useEditor,
} from "@tiptap/react"

import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"

import { Loader2 } from "lucide-react"

import { useProject } from "@/context/ProjectContext"

import { EditorToolbar } from "./EditorToolbar"
import { AITextMark } from "./AITextMark"

import "./NovelEditor.css"

export function NovelEditor() {
  const {
    project,
    activeScene,
    updateSceneContent,
  } = useProject()

  const [aiGenerating, setAIGenerating] =
    useState(false)

  const editor = useEditor({
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

    editor.commands.focus("start")
  }, [
    editor,
    activeScene?.id,
  ])

  // --------------------------------------------------
  // Save editor changes
  // --------------------------------------------------

  useEffect(() => {
    if (!editor || !activeScene) {
      return
    }

    const sceneId =
      activeScene.id

    const handleUpdate = () => {
      /*
       * Never save editor changes while AI
       * generation is controlling the editor.
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

        setAIGenerating(true)

        /*
         * IMPORTANT:
         *
         * Continue must ALWAYS start from the
         * actual end of the document.
         *
         * Do NOT use editor.state.selection.from
         * here because the author's cursor may be
         * somewhere in the middle of a long scene.
         */
        const documentEnd =
          editor.state.doc.content.size

        /*
         * Get the actual text at the end of the
         * current scene.
         *
         * We give the AI the complete text that
         * currently exists before the insertion
         * point so it can continue naturally.
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

The author's current scene ends with:

${existingText}

Continue naturally from the final sentence and final word above.

IMPORTANT:
- Write only the continuation prose.
- Do not explain what you are doing.
- Do not repeat any existing text.
- Do not restart or rewrite the scene.
- Continue directly from the final word of the author's text.
- Maintain the current POV, tense, tone, characters, setting, pacing, and narrative style.
- Treat everything above as existing manuscript text.
- The continuation must begin after the existing manuscript, not before it.`,
          },
        ]

        /*
         * This position is deliberately initialized
         * to the TRUE end of the document.
         *
         * It is then updated after every streamed
         * insertion.
         */
        let insertionPosition =
          editor.state.doc.content.size

        try {
          const {
            streamAIChat,
          } = await import(
            "@/components/ai/aiservice/aiService"
          )

          /*
           * Put the cursor at the actual end of
           * the manuscript before streaming begins.
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
            messages,
            project,
            activeScene,

            onToken: (
              token,
            ) => {
              if (!token) {
                return
              }

              /*
               * Always insert at the explicit
               * insertion position.
               *
               * This prevents the streamed response
               * from accidentally being inserted at
               * an old/stale cursor position.
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
               * Re-read the editor's current
               * document position after insertion.
               *
               * This is safer than calculating the
               * number of characters ourselves because
               * ProseMirror positions include document
               * structure, paragraphs, hard breaks,
               * marks, etc.
               */
              insertionPosition =
                editor.state.selection.from
            },
          })

          /*
           * Stop applying the AI mark after
           * generation has completed.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              insertionPosition,
            )
            .unsetMark("aiText")
            .run()

          /*
           * Explicitly save the final document.
           *
           * This guarantees the generated continuation
           * is persisted even though normal update
           * handling is disabled during AI generation.
           */
          updateSceneContent(
            activeScene.id,
            editor.getJSON(),
          )
        } catch (error) {
          console.error(
            "AI continue writing failed:",
            error,
          )

          /*
           * Make sure the AI mark does not remain
           * active after an error.
           */
          editor
            .chain()
            .focus()
            .setTextSelection(
              insertionPosition,
            )
            .unsetMark("aiText")
            .run()
        } finally {
          /*
           * This ALWAYS runs, whether AI
           * succeeds or fails.
           */
          setAIGenerating(false)
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

  if (!editor) {
    return null
  }

  return (
    <div className="mnemeona-editor-shell">
      {/* -------------------------------------------------- */}
      {/* AI Generation Indicator */}
      {/* -------------------------------------------------- */}

      {aiGenerating && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-primary/5 px-4 text-xs text-primary">
          <Loader2 className="size-3.5 animate-spin" />

          <span>
            Mnemeona AI is continuing your scene...
          </span>

          <span className="ml-auto text-muted-foreground">
            Editing temporarily disabled
          </span>
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
    </div>
  )
}
