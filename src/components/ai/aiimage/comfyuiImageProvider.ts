export interface ComfyUIImageConfig {
  endpoint: string

  /**
   * Name of the checkpoint file inside:
   *
   * ComfyUI/models/checkpoints/
   *
   * If empty, Mnemeona asks ComfyUI for available
   * checkpoints and uses the first one.
   */
  checkpoint: string
}

export interface ImageGenerationOptions {
  prompt: string

  negativePrompt?: string

  width?: number

  height?: number

  steps?: number

  cfg?: number

  seed?: number

  signal?: AbortSignal

  onProgress?: (
    progress: number,
  ) => void
}

export interface GeneratedImage {
  blob: Blob

  mimeType: string

  width: number

  height: number

  seed?: number
}

const STORAGE_KEY =
  "mnemeona-comfyui-settings"

export const DEFAULT_COMFYUI_CONFIG: ComfyUIImageConfig =
  {
    endpoint:
      "http://127.0.0.1:8188",

    checkpoint:
      "",
  }

export function loadComfyUIConfig(): ComfyUIImageConfig {
  try {
    const stored =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!stored) {
      return {
        ...DEFAULT_COMFYUI_CONFIG,
      }
    }

    return {
      ...DEFAULT_COMFYUI_CONFIG,
      ...JSON.parse(stored),
    }
  } catch {
    return {
      ...DEFAULT_COMFYUI_CONFIG,
    }
  }
}

export function saveComfyUIConfig(
  config: ComfyUIImageConfig,
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      config,
    ),
  )
}

function normalizeEndpoint(
  endpoint: string,
): string {
  return endpoint.replace(
    /\/+$/,
    "",
  )
}

function createClientId(): string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function createSeed(): number {
  return Math.floor(
    Math.random() *
      4294967295,
  )
}

function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    const error =
      new Error(
        "Image generation cancelled.",
      )

    error.name =
      "AbortError"

    throw error
  }
}

async function comfyFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let response: Response

  try {
    response =
      await fetch(
        url,
        options,
      )
  } catch (error) {
    throw new Error(
      "Unable to connect to ComfyUI. Make sure ComfyUI is running and its CORS setting allows Mnemeona.",
      {
        cause:
          error,
      },
    )
  }

  if (!response.ok) {
    let message =
      `ComfyUI returned HTTP ${response.status}.`

    try {
      const text =
        await response.text()

      if (text.trim()) {
        message =
          text.trim()
      }
    } catch {
      // Keep default message.
    }

    throw new Error(
      message,
    )
  }

  return response
}

interface ObjectInfo {
  CheckpointLoaderSimple?: {
    input?: {
      required?: {
        ckpt_name?: [
          string[],
        ]
      }
    }
  }
}

export async function getAvailableCheckpoints(): Promise<
  string[]
> {
  const config =
    loadComfyUIConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await comfyFetch(
      `${endpoint}/object_info`,
    )

  const objectInfo =
    (await response.json()) as ObjectInfo

  return (
    objectInfo
      .CheckpointLoaderSimple
      ?.input
      ?.required
      ?.ckpt_name?.[0] ??
    []
  )
}

async function resolveCheckpoint(
  configuredCheckpoint: string,
): Promise<string> {
  if (
    configuredCheckpoint.trim()
  ) {
    return configuredCheckpoint.trim()
  }

  const checkpoints =
    await getAvailableCheckpoints()

  if (!checkpoints.length) {
    throw new Error(
      "ComfyUI has no checkpoints installed. Put an SDXL-compatible checkpoint in ComfyUI/models/checkpoints/ and restart ComfyUI.",
    )
  }

  return checkpoints[0]
}

/**
 * This is a deliberately simple API-format workflow.
 *
 * It uses:
 *
 * CheckpointLoaderSimple
 * CLIPTextEncode
 * EmptyLatentImage
 * KSampler
 * VAEDecode
 * SaveImage
 *
 * This is intended for SDXL-compatible checkpoints.
 *
 * Later we can add Flux/Klein workflows without
 * changing the rest of Mnemeona.
 */
function buildSDXLWorkflow(
  checkpoint: string,
  options: ImageGenerationOptions,
  seed: number,
): Record<
  string,
  {
    class_type: string
    inputs: Record<
      string,
      unknown
    >
  }
> {
  const width =
    options.width ??
    768

  const height =
    options.height ??
    1024

  const steps =
    options.steps ??
    25

  const cfg =
    options.cfg ??
    7

  const negativePrompt =
    options.negativePrompt ??
    [
      "text",
      "watermark",
      "signature",
      "logo",
      "caption",
      "blurry",
      "low quality",
      "deformed",
      "bad anatomy",
    ].join(
      ", ",
    )

  return {
    "1": {
      class_type:
        "CheckpointLoaderSimple",

      inputs: {
        ckpt_name:
          checkpoint,
      },
    },

    "2": {
      class_type:
        "CLIPTextEncode",

      inputs: {
        text:
          options.prompt,

        clip: [
          "1",
          1,
        ],
      },
    },

    "3": {
      class_type:
        "CLIPTextEncode",

      inputs: {
        text:
          negativePrompt,

        clip: [
          "1",
          1,
        ],
      },
    },

    "4": {
      class_type:
        "EmptyLatentImage",

      inputs: {
        width,

        height,

        batch_size: 1,
      },
    },

    "5": {
      class_type:
        "KSampler",

      inputs: {
        seed,

        steps,

        cfg,

        sampler_name:
          "euler",

        scheduler:
          "normal",

        denoise: 1,

        model: [
          "1",
          0,
        ],

        positive: [
          "2",
          0,
        ],

        negative: [
          "3",
          0,
        ],

        latent_image: [
          "4",
          0,
        ],
      },
    },

    "6": {
      class_type:
        "VAEDecode",

      inputs: {
        samples: [
          "5",
          0,
        ],

        vae: [
          "1",
          2,
        ],
      },
    },

    "7": {
      class_type:
        "SaveImage",

      inputs: {
        filename_prefix:
          "mnemeona",

        images: [
          "6",
          0,
        ],
      },
    },
  }
}

interface PromptResponse {
  prompt_id: string
}

interface HistoryOutput {
  filename: string

  subfolder: string

  type: string
}

interface HistoryEntry {
  outputs?: Record<
    string,
    {
      images?: HistoryOutput[]
    }
  >
}

async function queuePrompt(
  workflow: Record<
    string,
    unknown
  >,
  clientId: string,
): Promise<string> {
  const config =
    loadComfyUIConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await comfyFetch(
      `${endpoint}/prompt`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          {
            prompt:
              workflow,

            client_id:
              clientId,
          },
        ),
      },
    )

  const data =
    (await response.json()) as PromptResponse

  if (
    !data.prompt_id
  ) {
    throw new Error(
      "ComfyUI accepted the request but did not return a prompt ID.",
    )
  }

  return data.prompt_id
}

async function getHistory(
  promptId: string,
): Promise<HistoryEntry | null> {
  const config =
    loadComfyUIConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await comfyFetch(
      `${endpoint}/history/${encodeURIComponent(
        promptId,
      )}`,
    )

  const data =
    (await response.json()) as Record<
      string,
      HistoryEntry
    >

  return (
    data[promptId] ??
    null
  )
}

function findOutputImage(
  history: HistoryEntry,
): HistoryOutput | null {
  if (!history.outputs) {
    return null
  }

  for (const output of Object.values(
    history.outputs,
  )) {
    const image =
      output.images?.find(
        (item) =>
          item.type ===
          "output",
      )

    if (image) {
      return image
    }

    if (
      output.images?.length
    ) {
      return output.images[0]
    }
  }

  return null
}

async function waitForImage(
  promptId: string,
  signal?: AbortSignal,
  onProgress?: (
    progress: number,
  ) => void,
): Promise<HistoryOutput> {
  const timeout =
    15 * 60 * 1000

  const started =
    Date.now()

  while (
    Date.now() -
      started <
    timeout
  ) {
    throwIfAborted(
      signal,
    )

    const history =
      await getHistory(
        promptId,
      )

    if (history) {
      const image =
        findOutputImage(
          history,
        )

      if (image) {
        onProgress?.(
          100,
        )

        return image
      }
    }

    /*
     * We don't know the exact KSampler progress
     * without subscribing to ComfyUI's websocket.
     *
     * A conservative progress indicator is preferable
     * to pretending we know the exact percentage.
     */
    onProgress?.(
      15,
    )

    await new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          1000,
        ),
    )
  }

  throw new Error(
    "ComfyUI did not finish the image within 15 minutes.",
  )
}

async function downloadOutputImage(
  output: HistoryOutput,
): Promise<Blob> {
  const config =
    loadComfyUIConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const params =
    new URLSearchParams()

  params.set(
    "filename",
    output.filename,
  )

  params.set(
    "subfolder",
    output.subfolder ??
      "",
  )

  params.set(
    "type",
    output.type ??
      "output",
  )

  const response =
    await comfyFetch(
      `${endpoint}/view?${params.toString()}`,
    )

  return response.blob()
}

export async function generateImage(
  options: ImageGenerationOptions,
): Promise<GeneratedImage> {
  throwIfAborted(
    options.signal,
  )

  const config =
    loadComfyUIConfig()

  const checkpoint =
    await resolveCheckpoint(
      config.checkpoint,
    )

  throwIfAborted(
    options.signal,
  )

  const seed =
    typeof options.seed ===
    "number"
      ? options.seed
      : createSeed()

  const workflow =
    buildSDXLWorkflow(
      checkpoint,
      options,
      seed,
    )

  const clientId =
    createClientId()

  const promptId =
    await queuePrompt(
      workflow,
      clientId,
    )

  options.onProgress?.(
    5,
  )

  const output =
    await waitForImage(
      promptId,
      options.signal,
      options.onProgress,
    )

  throwIfAborted(
    options.signal,
  )

  const blob =
    await downloadOutputImage(
      output,
    )

  options.onProgress?.(
    100,
  )

  return {
    blob,

    mimeType:
      blob.type ||
      "image/png",

    width:
      options.width ??
      768,

    height:
      options.height ??
      1024,

    seed,
  }
}

export async function testComfyUIConnection(): Promise<void> {
  const config =
    loadComfyUIConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await comfyFetch(
      `${endpoint}/system_stats`,
    )

  if (!response.ok) {
    throw new Error(
      "ComfyUI did not respond correctly.",
    )
  }

  const checkpoints =
    await getAvailableCheckpoints()

  if (!checkpoints.length) {
    throw new Error(
      "ComfyUI is running, but no checkpoints are installed.",
    )
  }
}
