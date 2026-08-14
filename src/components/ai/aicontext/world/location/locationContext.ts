import type { Scene } from "@/types/manuscript"
import type { Location } from "@/types/world/location"

import { detectLocationMentions } from "./detectLocationMentions"

export interface LocationContext {
  locations: Location[]
  detectedLocations: LocationMention[]
}

export interface LocationMention {
  locationId: string
  matchedText: string
  confidence: number
  source: "name" | "alias"
}

/**
 * Builds location-related AI context
 * for a scene.
 *
 * Location relevance comes from:
 *
 * 1. The location explicitly assigned to the scene.
 * 2. Location names detected in the scene text.
 *
 * Automatic detection does not modify
 * the scene.
 */
export function buildLocationContext(
  scene: Scene,
  locations: Location[],
): LocationContext {
  const detectedLocations =
    detectLocationMentions(
      scene,
      locations,
    )

  const explicitLocations =
    locations.filter(
      (location) =>
        scene.location?.trim() &&
        location.name
          .trim()
          .toLocaleLowerCase() ===
          scene.location
            .trim()
            .toLocaleLowerCase(),
    )

  const relevantLocationIds =
    new Set([
      ...explicitLocations.map(
        (location) =>
          location.id,
      ),

      ...detectedLocations.map(
        (mention) =>
          mention.locationId,
      ),
    ])

  const relevantLocations =
    locations.filter(
      (location) =>
        relevantLocationIds.has(
          location.id,
        ),
    )

  return {
    locations:
      relevantLocations,

    detectedLocations,
  }
}
