export interface LCMConfig {
  endpoint: string
}

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export interface GenerateImageResult {
  blob: Blob
  mimeType: string
  width?: number
  height?: number
  seed?: number
}

const STORAGE_KEY =
  "mnemeona-lcm-settings"

export const DEFAULT_LCM_CONFIG: LCMConfig = {
  endpoint:
    "http://127.0.0.1:8199",
}

export function loadLCMConfig(): LCMConfig {
  if (
    typeof window ===
    "undefined"
  ) {
    return DEFAULT_LCM_CONFIG
  }

  try {
    const stored =
      window.localStorage.getItem(
        STORAGE_KEY,
      )

    if (!stored) {
      return DEFAULT_LCM_CONFIG
    }

    const parsed =
      JSON.parse(stored)

    return {
      ...DEFAULT_LCM_CONFIG,
      ...parsed,
    }
  } catch {
    return DEFAULT_LCM_CONFIG
  }
}

export function saveLCMConfig(
  config: LCMConfig,
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(config),
  )
}

function buildURL(
  endpoint: string,
  path: string,
): string {
  return `${endpoint.replace(
    /\/+$/,
    "",
  )}${path}`
}

async function lcmFetch(
  endpoint: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(
      buildURL(
        endpoint,
        path,
      ),
      init,
    )
  } catch (error) {
    if (
      error instanceof
      Error
    ) {
      throw new Error(
        "Unable to connect to the Mnemeona image service. " +
          "Make sure the local LCM DreamShaper service is running at " +
          `${endpoint}.`,
      )
    }

    throw error
  }
}

export async function testLCMConnection(): Promise<void> {
  const config =
    loadLCMConfig()

  const response =
    await lcmFetch(
      config.endpoint,
      "/health",
    )

  if (!response.ok) {
    throw new Error(
      `LCM image service returned HTTP ${response.status}.`,
    )
  }

  const data =
    await response
      .json()
      .catch(
        () => null,
      )

  if (
    data &&
    data.ok === false
  ) {
    throw new Error(
      "The local LCM image service reported that it is not ready.",
    )
  }
}

export async function getLCMStatus(): Promise<unknown> {
  const config =
    loadLCMConfig()

  const response =
    await lcmFetch(
      config.endpoint,
      "/status",
    )

  if (!response.ok) {
    throw new Error(
      `LCM image service returned HTTP ${response.status}.`,
    )
  }

  return response.json()
}

export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const config =
    loadLCMConfig()

  const {
    prompt,
    width = 768,
    height = 768,
    steps = 4,
    seed,
    signal,
    onProgress,
  } = options

  onProgress?.(5)

  const body: {
    prompt: string
    width: number
    height: number
    steps: number
    seed?: number
  } = {
    prompt,
    width,
    height,
    steps,
  }

  if (
    seed !== undefined
  ) {
    body.seed = seed
  }

  const response =
    await lcmFetch(
      config.endpoint,
      "/generate",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            body,
          ),

        signal,
      },
    )

  onProgress?.(90)

  if (!response.ok) {
    let message =
      `LCM image generation failed with HTTP ${response.status}.`

    try {
      const errorData =
        await response.json()

      if (
        typeof errorData
          ?.detail ===
        "string"
      ) {
        message =
          errorData.detail
      }
    } catch {
      // Keep the default HTTP error.
    }

    throw new Error(
      message,
    )
  }

  const blob =
    await response.blob()

  if (
    !blob.size
  ) {
    throw new Error(
      "The LCM image service returned an empty image.",
    )
  }

  const mimeType =
    response.headers.get(
      "Content-Type",
    ) ||
    blob.type ||
    "image/png"

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

  const parsedSeed =
    seedHeader !== null
      ? Number(seedHeader)
      : undefined

  const parsedWidth =
    widthHeader !== null
      ? Number(widthHeader)
      : undefined

  const parsedHeight =
    heightHeader !== null
      ? Number(heightHeader)
      : undefined

  onProgress?.(100)

  return {
    blob,
    mimeType,
    width:
      Number.isFinite(
        parsedWidth,
      )
        ? parsedWidth
        : undefined,
    height:
      Number.isFinite(
        parsedHeight,
      )
        ? parsedHeight
        : undefined,
    seed:
      Number.isFinite(
        parsedSeed,
      )
        ? parsedSeed
        : undefined,
  }
}
