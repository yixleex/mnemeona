import { useEffect, useState } from "react"

import {
  Check,
  Cpu,
  Loader2,
  Server,
  Settings2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  loadAIConfig,
  saveAIConfig,
  testAIConnection,
  type AIConfig,
} from "@/components/ai/aiservice/aiService"

interface AISettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsProps) {
  const [config, setConfig] =
    useState<AIConfig>(() =>
      loadAIConfig(),
    )

  const [saved, setSaved] =
    useState(false)

  const [testing, setTesting] =
    useState(false)

  const [connectionStatus, setConnectionStatus] =
    useState<
      "idle" | "success" | "error"
    >("idle")

  const [connectionError, setConnectionError] =
    useState("")

  // --------------------------------------------------
  // Load settings whenever dialog opens
  // --------------------------------------------------

  useEffect(() => {
    if (!open) {
      return
    }

    setConfig(loadAIConfig())
    setSaved(false)
    setConnectionStatus("idle")
    setConnectionError("")
  }, [open])

  // --------------------------------------------------
  // Update field
  // --------------------------------------------------

  const updateField = <
    K extends keyof AIConfig,
  >(
    field: K,
    value: AIConfig[K],
  ) => {
    setConfig((current) => ({
      ...current,
      [field]: value,
    }))

    setSaved(false)
    setConnectionStatus("idle")
    setConnectionError("")
  }

  // --------------------------------------------------
  // Save
  // --------------------------------------------------

  const handleSave = () => {
    saveAIConfig(config)

    const savedConfig =
      loadAIConfig()

    setConfig(savedConfig)
    setSaved(true)
    setConnectionStatus("idle")
    setConnectionError("")

    window.setTimeout(() => {
      setSaved(false)
    }, 2000)
  }

  // --------------------------------------------------
  // Test connection
  // --------------------------------------------------

  const handleTestConnection =
    async () => {
      const endpoint =
        config.endpoint.trim()

      const model =
        config.model.trim()

      if (!endpoint) {
        setConnectionStatus("error")
        setConnectionError(
          "Enter a server URL before testing the connection.",
        )
        return
      }

      if (!model) {
        setConnectionStatus("error")
        setConnectionError(
          "Enter a model before testing the connection.",
        )
        return
      }

      setTesting(true)
      setConnectionStatus("idle")
      setConnectionError("")

      try {
        /*
         * Save the current form first.
         *
         * This ensures the test uses the values currently
         * displayed in the dialog rather than older settings.
         */
        saveAIConfig({
          ...config,
          endpoint,
          model,
        })

        /*
         * This now performs an actual model request rather
         * than merely checking /api/tags.
         */
        await testAIConnection()

        setConnectionStatus(
          "success",
        )
        setConnectionError("")
      } catch (error) {
        console.error(
          "AI model connection test failed:",
          error,
        )

        const message =
          error instanceof Error
            ? error.message
            : "The configured AI model could not answer the test request."

        setConnectionStatus(
          "error",
        )
        setConnectionError(
          message,
        )
      } finally {
        setTesting(false)
      }
    }

  const canTest =
    config.endpoint.trim().length >
      0 &&
    config.model.trim().length >
      0 &&
    !testing

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="
          fixed
          left-1/2
          top-1/2
          z-[100]
          flex
          max-h-[90vh]
          w-[min(720px,calc(100vw-2rem))]
          -translate-x-1/2
          -translate-y-1/2
          flex-col
          overflow-hidden
          rounded-2xl
          border
          bg-background
          p-0
          shadow-2xl
          sm:max-w-[720px]
        "
      >
        {/* -------------------------------------------------- */}
        {/* Header */}
        {/* -------------------------------------------------- */}

        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="size-5 text-primary" />
            </div>

            <div>
              <DialogTitle className="text-sm font-semibold">
                AI Settings
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs">
                Configure how Mnemeona connects to
                your AI.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* -------------------------------------------------- */}
        {/* Scrollable Content */}
        {/* -------------------------------------------------- */}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-8 p-6">

            {/* ------------------------------------------------ */}
            {/* Provider */}
            {/* ------------------------------------------------ */}

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  AI Provider
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Choose where Mnemeona gets its AI
                  responses.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Cpu className="size-5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium">
                      Local Model
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Connect Mnemeona to an AI model
                      running locally on your computer.
                    </p>
                  </div>

                  <div className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    Active
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------ */}
            {/* Server */}
            {/* ------------------------------------------------ */}

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Local Model Server
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Tell Mnemeona where your local AI
                  server is running.
                </p>
              </div>

              <div className="space-y-5 rounded-xl border bg-card p-5">

                {/* Endpoint */}

                <div className="space-y-2">
                  <label
                    htmlFor="ai-endpoint"
                    className="text-sm font-medium"
                  >
                    Server URL
                  </label>

                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="ai-endpoint"
                      value={
                        config.endpoint
                      }
                      onChange={(event) =>
                        updateField(
                          "endpoint",
                          event.target.value,
                        )
                      }
                      placeholder="http://localhost:11434"
                      className="pl-9"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    The base URL of your local
                    model server.
                  </p>
                </div>

                {/* Model */}

                <div className="space-y-2">
                  <label
                    htmlFor="ai-model"
                    className="text-sm font-medium"
                  >
                    Model
                  </label>

                  <Input
                    id="ai-model"
                    value={
                      config.model
                    }
                    onChange={(event) =>
                      updateField(
                        "model",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. qwen3:14b"
                  />

                  <p className="text-xs text-muted-foreground">
                    The model identifier used by
                    your local server.
                  </p>
                </div>

                {/* API Key */}

                <div className="space-y-2">
                  <label
                    htmlFor="ai-api-key"
                    className="text-sm font-medium"
                  >
                    API Key

                    <span className="ml-2 font-normal text-muted-foreground">
                      Optional
                    </span>
                  </label>

                  <Input
                    id="ai-api-key"
                    type="password"
                    value={
                      config.apiKey
                    }
                    onChange={(event) =>
                      updateField(
                        "apiKey",
                        event.target.value,
                      )
                    }
                    placeholder="Leave empty if not required"
                  />
                </div>

                {/* Test Connection */}

                <div className="flex items-center justify-between gap-4 border-t pt-5">
                  <div className="min-w-0">

                    {connectionStatus ===
                      "success" && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="size-4 shrink-0" />

                        Model responded
                        successfully.
                      </div>
                    )}

                    {connectionStatus ===
                      "error" && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-destructive">
                          AI model test failed.
                        </div>

                        {connectionError && (
                          <div className="max-w-[420px] text-xs leading-relaxed text-destructive/80">
                            {connectionError}
                          </div>
                        )}
                      </div>
                    )}

                    {connectionStatus ===
                      "idle" && (
                      <span className="text-xs text-muted-foreground">
                        Enter a model and test that it can
                        actually respond before using AI.
                      </span>
                    )}

                  </div>

                  <Button
                    variant="outline"
                    onClick={
                      handleTestConnection
                    }
                    disabled={!canTest}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />

                        Testing...
                      </>
                    ) : (
                      "Test Model"
                    )}
                  </Button>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------ */}
            {/* Privacy */}
            {/* ------------------------------------------------ */}

            <section className="rounded-xl border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 size-5 shrink-0 text-muted-foreground" />

                <div>
                  <h2 className="text-sm font-medium">
                    Local AI & Privacy
                  </h2>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    When using a local model, your
                    manuscript and AI context can
                    remain on your computer.

                    Mnemeona will communicate
                    directly with the configured
                    local server.
                  </p>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------ */}
            {/* Save */}
            {/* ------------------------------------------------ */}

            <div className="flex items-center justify-end gap-3 pb-2">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Check className="size-4" />

                  Settings saved
                </span>
              )}

              <Button
                onClick={
                  handleSave
                }
              >
                Save AI Settings
              </Button>
            </div>

          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* Footer */}
        {/* -------------------------------------------------- */}

        <div className="flex shrink-0 justify-end border-t bg-muted/20 px-6 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
