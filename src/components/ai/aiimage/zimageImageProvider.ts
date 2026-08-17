export interface ZImageConfig {
  endpoint: string
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
  "mnemeona-zimage-settings"

export const DEFAULT_ZIMAGE_CONFIG: ZImageConfig =
  {
    endpoint:
      "http://127.0.0.1:8199",
  }

export function loadZImageConfig(): ZImageConfig {
  try {
    const stored =
      localStorage.getItem(
        STORAGE_KEY,
      )

    if (!stored) {
      return {
        ...DEFAULT_ZIMAGE_CONFIG,
      }
    }

    return {
      ...DEFAULT_ZIMAGE_CONFIG,
      ...JSON.parse(stored),
    }
  } catch {
    return {
      ...DEFAULT_ZIMAGE_CONFIG,
    }
  }
}

export function saveZImageConfig(
  config: ZImageConfig,
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

async function zImageFetch(
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
      "Unable to connect to the Mnemeona image service. Make sure the local Z-Image server is running.",
      {
        cause:
          error,
      },
    )
  }

  if (!response.ok) {
    let message =
      `Mnemeona image service returned HTTP ${response.status}.`

    try {
      const text =
        await response.text()

      if (text.trim()) {
        try {
          const json =
            JSON.parse(text)

          message =
            json.detail ??
            message
        } catch {
          message =
            text.trim()
        }
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

export async function testZImageConnection(): Promise<void> {
  const config =
    loadZImageConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await zImageFetch(
      `${endpoint}/health`,
    )

  const data =
    await response.json() as {
      ok?: boolean
      model?: string
    }

  if (!data.ok) {
    throw new Error(
      "The Mnemeona image service did not report a healthy status.",
    )
  }

  if (
    data.model !==
    "Z-Image-Turbo"
  ) {
    throw new Error(
      "The local image service is not running Z-Image-Turbo.",
    )
  }
}

export async function getZImageStatus(): Promise<unknown> {
  const config =
    loadZImageConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const response =
    await zImageFetch(
      `${endpoint}/status`,
    )

  return response.json()
}

export async function generateImage(
  options: ImageGenerationOptions,
): Promise<GeneratedImage> {
  if (
    options.signal?.aborted
  ) {
    const error =
      new Error(
        "Image generation cancelled.",
      )

    error.name =
      "AbortError"

    throw error
  }

  const config =
    loadZImageConfig()

  const endpoint =
    normalizeEndpoint(
      config.endpoint,
    )

  const width =
    options.width ??
    768

  const height =
    options.height ??
    1024

  const steps =
    options.steps ??
    8

  options.onProgress?.(
    5,
  )

  const response =
    await zImageFetch(
      `${endpoint}/generate`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            prompt:
              options.prompt,

            width,

            height,

            steps,

            seed:
              options.seed ??
              null,
          }),

        signal:
          options.signal,
      },
    )

  options.onProgress?.(
    95,
  )

  const blob =
    await response.blob()

  const seedHeader =
    response.headers.get(
      "X-Mnemeona-Seed",
    )

  const widthHeader =
    response.headers.get(
      "X-Mnemeona-Width",
    )

  const heightHeader =
    response.headers.get(
      "X-Mnemeona-Height",
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
      Number(
        widthHeader ??
          width,
      ),

    height:
      Number(
        heightHeader ??
          height,
      ),

    seed:
      seedHeader
        ? Number(
            seedHeader,
          )
        : undefined,
  }
}
