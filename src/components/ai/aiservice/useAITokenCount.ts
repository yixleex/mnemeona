import {
  useCallback,
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
 * IMPORTANT:
 *
 * This hook deliberately does NOT start a token-count request
 * automatically.
 *
 * The actual Ollama calculation only starts when the caller
 * explicitly invokes calculateTokenCount().
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

  /*
   * Do NOT calculate automatically.
   *
   * This function is intentionally exposed to the UI so that
   * an expensive Ollama prompt evaluation only happens after
   * the user explicitly asks for it.
   */
  const calculateTokenCount =
    useCallback(() => {
      if (!request) {
        return
      }

      ensureAITokenCount(
        request,
      )
    }, [request])

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

    calculateTokenCount,
  }
}
