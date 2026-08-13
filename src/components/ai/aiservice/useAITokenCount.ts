import {
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"

import type { MnemeonaProject } from "@/types/project"

import {
  createAITokenCountKey,
  ensureAITokenCount,
  getAITokenCount,
  subscribeAITokenCounts,
  type AITokenCountRequest,
} from "./aiTokenCounter"

type ProjectScene =
  MnemeonaProject["manuscript"]["acts"][number]["chapters"][number]["scenes"][number]

interface UseAITokenCountOptions {
  project: MnemeonaProject

  activeScene:
    | ProjectScene
    | null

  responseTokens: number

  messages?: AITokenCountRequest["messages"]
}

/**
 * Persistent model-aware token gauge.
 *
 * The actual request lives in aiTokenCounter.ts, outside React.
 * Unmounting the component therefore does not cancel the request.
 */
export function useAITokenCount({
  project,
  activeScene,
  responseTokens,
  messages = [],
}: UseAITokenCountOptions) {
  const request =
    useMemo<AITokenCountRequest | null>(
      () => {
        if (!activeScene) {
          return null
        }

        return {
          project,
          activeScene,
          responseTokens,
          messages,
        }
      },
      [
        project,
        activeScene,
        responseTokens,
        messages,
      ],
    )

  const key =
    useMemo(
      () =>
        request
          ? createAITokenCountKey(
              request,
            )
          : "",
      [request],
    )

  useEffect(() => {
    if (!request) {
      return
    }

    ensureAITokenCount(
      request,
    )
  }, [
    request,
  ])

  const snapshot =
    useSyncExternalStore(
      subscribeAITokenCounts,

      () =>
        key
          ? getAITokenCount(
              key,
            )
          : null,

      () => null,
    )

  return {
    tokenCount:
      snapshot,

    isCalculating:
      snapshot?.isCalculating ??
      false,

    isApproximate:
      snapshot?.source ===
      "estimate",
  }
}
