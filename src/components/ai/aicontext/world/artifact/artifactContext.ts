import type { Scene } from "@/types/manuscript"
import type { Artifact } from "@/types/world/artifact"

import type {
  ArtifactMention,
} from "@/types/aicontext"

import {
  detectArtifactMentions,
} from "./detectArtifactMentions"

export interface ArtifactContext {
  artifacts: Artifact[]

  detectedArtifacts: ArtifactMention[]
}

/**
 * Builds artifact-related AI context for a scene.
 *
 * An artifact becomes relevant when its name or one of its
 * aliases is mentioned in the scene.
 */
export function buildArtifactContext(
  scene: Scene,
  artifacts: Artifact[] = [],
): ArtifactContext {
  const detectedArtifacts =
    detectArtifactMentions(
      scene,
      artifacts,
    )

  const relevantArtifactIds =
    new Set(
      detectedArtifacts.map(
        (mention) =>
          mention.artifactId,
      ),
    )

  const relevantArtifacts =
    artifacts.filter(
      (artifact) =>
        relevantArtifactIds.has(
          artifact.id,
        ),
    )

  return {
    artifacts:
      relevantArtifacts,

    detectedArtifacts,
  }
}
