import type { JSONContent } from "@tiptap/core"

import type {
  Act,
  Scene,
} from "@/types/manuscript"

// --------------------------------------------------
// Word Count
// --------------------------------------------------

export function countWords(
  content: JSONContent,
): number {
  let text = ""

  const extractText = (
    node: JSONContent,
  ) => {
    if (node.text) {
      text += `${node.text} `
    }

    if (node.content) {
      node.content.forEach(
        extractText,
      )
    }
  }

  extractText(content)

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

// --------------------------------------------------
// Scene Lookup
// --------------------------------------------------

export function findScene(
  acts: Act[],
  sceneId: string | null,
): Scene | null {
  if (!sceneId) {
    return null
  }

  for (const act of acts) {
    for (const chapter of act.chapters) {
      const scene =
        chapter.scenes.find(
          (scene) =>
            scene.id === sceneId,
        )

      if (scene) {
        return scene
      }
    }
  }

  return null
}

// --------------------------------------------------
// First Scene
// --------------------------------------------------

export function findFirstSceneId(
  acts: Act[],
): string | null {
  for (const act of acts) {
    for (const chapter of act.chapters) {
      if (chapter.scenes.length > 0) {
        return chapter.scenes[0].id
      }
    }
  }

  return null
}

// --------------------------------------------------
// Project Word Count
// --------------------------------------------------

export function calculateProjectWordCount(
  acts: Act[],
): number {
  return acts
    .flatMap(
      (act) => act.chapters,
    )
    .flatMap(
      (chapter) => chapter.scenes,
    )
    .reduce(
      (total, scene) =>
        total +
        countWords(scene.content),
      0,
    )
}

// --------------------------------------------------
// Scene Word Count
// --------------------------------------------------

export function calculateSceneWordCount(
  scene: Scene | null,
): number {
  if (!scene) {
    return 0
  }

  return countWords(scene.content)
}
