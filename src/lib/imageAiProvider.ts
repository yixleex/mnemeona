export interface ImageAiProvider {
  id: string
  name: string
  version?: string
  type?: string
  enabled: boolean
  installed?: boolean
  active: boolean
}

export interface ImageAiProvidersResponse {
  active_provider: string
  providers: ImageAiProvider[]
  active_status?: Record<string, unknown> | null
}

export interface ImageAiConfig {
  endpoint: string
  provider: string
  settings: Record<string, unknown>
}

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  provider?: string
  settings?: Record<string, unknown>
  signal?: AbortSignal
  onProgress?: (
    progress: number,
  ) => void
}

export interface GenerateImageResult {
  blob: Blob
  mimeType: string
  width?: number
  height?: number
  seed?: number
  provider?: string
}

export interface ImageAiSettingsSchema {
  type?: string
  properties?: Record<
    string,
    {
      type?: string
      title?: string
      description?: string
      default?: unknown
      minimum?: number
      maximum?: number
      step?: number
      enum?: unknown[]
    }
  >
}

const STORAGE_KEY =
  "mnemeona-image-ai-settings"

export const DEFAULT_IMAGE_AI_CONFIG: ImageAiConfig =
  {
    endpoint:
      "http://127.0.0.1:8000",

    provider: "lcm",

    settings: {},
  }


export function loadImageAiConfig(): ImageAiConfig {
  if (
    typeof window === "undefined"
  ) {
    return {
      ...DEFAULT_IMAGE_AI_CONFIG,
      settings: {},
    }
  }

  try {
    const stored =
      window.localStorage.getItem(
        STORAGE_KEY,
      )

    if (!stored) {
      return {
        ...DEFAULT_IMAGE_AI_CONFIG,
        settings: {},
      }
    }

    const parsed =
      JSON.parse(stored)

    return {
      ...DEFAULT_IMAGE_AI_CONFIG,
      ...parsed,
      settings: {
        ...DEFAULT_IMAGE_AI_CONFIG.settings,
        ...(parsed?.settings ?? {}),
      },
    }
  } catch {
    return {
      ...DEFAULT_IMAGE_AI_CONFIG,
      settings: {},
    }
  }
}


export function saveImageAiConfig(
  config: ImageAiConfig,
): void {
  if (
    typeof window === "undefined"
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


async function imageFetch(
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
    if (error instanceof Error) {
      throw new Error(
        "Unable to connect to the Mnemeona image service. " +
          `Make sure it is running at ${endpoint}.`,
      )
    }

    throw error
  }
}


export async function getImageProviders(): Promise<ImageAiProvidersResponse> {
  const config =
    loadImageAiConfig()

  const response =
    await imageFetch(
      config.endpoint,
      "/providers",
    )

  if (!response.ok) {
    throw new Error(
      `Image service returned HTTP ${response.status}.`,
    )
  }

  return response.json()
}


export async function getProviderSettingsSchema(
  providerId: string,
): Promise<ImageAiSettingsSchema> {
  const config =
    loadImageAiConfig()

  const response =
    await imageFetch(
      config.endpoint,
      `/providers/${encodeURIComponent(
        providerId,
      )}/settings`,
    )

  if (!response.ok) {
    throw new Error(
      `Could not load settings for ${providerId}.`,
    )
  }

  const data =
    await response.json()

  return data.schema ?? {}
}


export async function getProviderStatus(
  providerId: string,
): Promise<Record<string, unknown>> {
  const config =
    loadImageAiConfig()

  const response =
    await imageFetch(
      config.endpoint,
      `/providers/${encodeURIComponent(
        providerId,
      )}/status`,
    )

  if (!response.ok) {
    throw new Error(
      `Could not load status for ${providerId}.`,
    )
  }

  const data =
    await response.json()

  return data.status ?? {}
}


export async function testImageConnection(): Promise<ImageAiProvidersResponse> {
  return getImageProviders()
}


export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const config =
    loadImageAiConfig()

  const {
    prompt,
    width = 768,
    height = 768,
    steps = 4,
    seed,
    provider = config.provider,
    settings = config.settings,
    signal,
    onProgress,
  } = options

  onProgress?.(5)

  const body: Record<
    string,
    unknown
  > = {
    prompt,
    width,
    height,
    steps,
    provider,
    settings,
  }

  if (seed !== undefined) {
    body.seed = seed
  }

  const response =
    await imageFetch(
      config.endpoint,
      "/generate",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          body,
        ),

        signal,
      },
    )

  onProgress?.(90)

  if (!response.ok) {
    let message =
      `Image generation failed with HTTP ${response.status}.`

    try {
      const errorData =
        await response.json()

      if (
        typeof errorData?.detail ===
        "string"
      ) {
        message =
          errorData.detail
      }
    } catch {
      // Keep HTTP error.
    }

    throw new Error(message)
  }

  const blob =
    await response.blob()

  if (!blob.size) {
    throw new Error(
      "The image service returned an empty image.",
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

  const providerHeader =
    response.headers.get(
      "X-Mnemeona-Provider",
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

    provider:
      providerHeader ||
      provider,
  }
}
