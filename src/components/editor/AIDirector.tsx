import {
  useEffect,
  useState,
} from "react"

import {
  ArrowUp,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function AIDirector() {
  const [
    input,
    setInput,
  ] = useState("")

  const [
    generating,
    setGenerating,
  ] = useState(false)

  useEffect(() => {
    const handleResult = () => {
      setGenerating(false)
    }

    const handleRequest = () => {
      setGenerating(true)
    }

    window.addEventListener(
      "mnemeona:ai-director-result",
      handleResult,
    )

    window.addEventListener(
      "mnemeona:ai-director",
      handleRequest,
    )

    return () => {
      window.removeEventListener(
        "mnemeona:ai-director-result",
        handleResult,
      )

      window.removeEventListener(
        "mnemeona:ai-director",
        handleRequest,
      )
    }
  }, [])

  const sendInstruction = () => {
    const instruction =
      input.trim()

    if (
      !instruction ||
      generating
    ) {
      return
    }

    const requestId =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`

    setGenerating(true)
    setInput("")

    window.dispatchEvent(
      new CustomEvent(
        "mnemeona:ai-director",
        {
          detail: {
            requestId,
            instruction,
          },
        },
      ),
    )
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault()
      sendInstruction()
    }
  }

  return (
    <div className="shrink-0 border-t bg-background">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="shrink-0 text-xs font-medium text-muted-foreground">
          AI Director
        </div>

        {generating ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 shrink-0 animate-spin" />

            <span className="truncate">
              AI Director is continuing the scene...
            </span>
          </div>
        ) : (
          <div className="relative min-w-0 flex-1">
            <Textarea
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value,
                )
              }
              onKeyDown={
                handleKeyDown
              }
              disabled={generating}
              rows={1}
              placeholder="Tell the AI how you want the scene to continue..."
              className="min-h-8 resize-none py-1.5 pr-10 text-sm"
            />

            <Button
              type="button"
              size="icon"
              className="absolute bottom-1 right-1 size-6"
              disabled={
                !input.trim() ||
                generating
              }
              onClick={
                sendInstruction
              }
              title="Direct AI"
              aria-label="Direct AI"
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
