import type { Scene } from "@/types/manuscript"
import type { WorldEvent } from "@/types/world/event"
import type { WorldEventMention } from "@/types/aicontext"

import {
  detectWorldEventMentions,
} from "./detectWorldEventMentions"

export interface WorldEventContext {
  events: WorldEvent[]

  detectedEvents: WorldEventMention[]
}

/**
 * Builds world-event-related AI context
 * for a scene.
 *
 * Event relevance currently comes from:
 *
 * 1. World event names detected in the scene text.
 * 2. World event names detected in Additional Context.
 *
 * Automatic detection does not modify
 * the scene or project events.
 */
export function buildWorldEventContext(
  scene: Scene,
  events: WorldEvent[],
): WorldEventContext {
  const detectedEvents =
    detectWorldEventMentions(
      scene,
      events,
    )

  const relevantEventIds =
    new Set(
      detectedEvents.map(
        (mention) =>
          mention.eventId,
      ),
    )

  const relevantEvents =
    events.filter(
      (event) =>
        relevantEventIds.has(
          event.id,
        ),
    )

  return {
    events:
      relevantEvents,

    detectedEvents,
  }
}
