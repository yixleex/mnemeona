import type { Dispatch, SetStateAction } from "react"
import type { JSONContent } from "@tiptap/core"

import type { MnemeonaProject } from "@/types/project"
import type {
  Act,
  Chapter,
  Scene,
} from "@/types/manuscript"

import {
  createId,
} from "@/lib/project"

import {
  findFirstSceneId,
  findScene,
} from "../project/projectHelpers"

type SetProject =
  Dispatch<
    SetStateAction<MnemeonaProject>
  >

// --------------------------------------------------
// Active Scene
// --------------------------------------------------

export function setActiveScene(
  setProject: SetProject,
  sceneId: string | null,
) {
  setProject((current) => ({
    ...current,

    settings: {
      ...current.settings,
      activeSceneId: sceneId,
    },

    updatedAt:
      new Date().toISOString(),
  }))
}

// --------------------------------------------------
// Add Act
// --------------------------------------------------

export function addAct(
  setProject: SetProject,
) {
  setProject((current) => {
    const act: Act = {
      id: createId(),

      title: `Act ${
        current.manuscript.acts.length + 1
      }`,

      synopsis: "",

      chapters: [],
    }

    return {
      ...current,

      manuscript: {
        ...current.manuscript,

        acts: [
          ...current.manuscript.acts,
          act,
        ],
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Add Chapter
// --------------------------------------------------

export function addChapter(
  setProject: SetProject,
  actId: string,
) {
  setProject((current) => {
    const actIndex =
      current.manuscript.acts.findIndex(
        (act) =>
          act.id === actId,
      )

    if (actIndex === -1) {
      return current
    }

    const act =
      current.manuscript.acts[
        actIndex
      ]

    const chapter: Chapter = {
      id: createId(),

      title: `Chapter ${
        act.chapters.length + 1
      }`,

      synopsis: "",

      scenes: [],
    }

    const acts =
      [...current.manuscript.acts]

    acts[actIndex] = {
      ...act,

      chapters: [
        ...act.chapters,
        chapter,
      ],
    }

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Add Scene
// --------------------------------------------------

export function addScene(
  setProject: SetProject,
  actId: string,
  chapterId: string,
) {
  const sceneId = createId()

  setProject((current) => {
    const acts =
      current.manuscript.acts.map(
        (act) => {
          if (act.id !== actId) {
            return act
          }

          return {
            ...act,

            chapters:
              act.chapters.map(
                (chapter) => {
                  if (
                    chapter.id !==
                    chapterId
                  ) {
                    return chapter
                  }

                  const scene: Scene = {
                    id: sceneId,

                    title: `Scene ${
                      chapter.scenes.length +
                      1
                    }`,

                    content: {
                      type: "doc",

                      content: [
                        {
                          type: "paragraph",
                        },
                      ],
                    },

                    synopsis: "",
                    pov: "",
                    characterIds: [],
                    location: "",
                    time: "",
                    aiAdditionalContext: "",
                  }

                  return {
                    ...chapter,

                    scenes: [
                      ...chapter.scenes,
                      scene,
                    ],
                  }
                },
              ),
          }
        },
      )

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      settings: {
        ...current.settings,

        activeSceneId: sceneId,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Rename Act
// --------------------------------------------------

export function renameAct(
  setProject: SetProject,
  actId: string,
  title: string,
) {
  setProject((current) => ({
    ...current,

    manuscript: {
      ...current.manuscript,

      acts:
        current.manuscript.acts.map(
          (act) =>
            act.id === actId
              ? {
                  ...act,
                  title,
                }
              : act,
        ),
    },

    updatedAt:
      new Date().toISOString(),
  }))
}

// --------------------------------------------------
// Rename Chapter
// --------------------------------------------------

export function renameChapter(
  setProject: SetProject,
  actId: string,
  chapterId: string,
  title: string,
) {
  setProject((current) => ({
    ...current,

    manuscript: {
      ...current.manuscript,

      acts:
        current.manuscript.acts.map(
          (act) =>
            act.id !== actId
              ? act
              : {
                  ...act,

                  chapters:
                    act.chapters.map(
                      (chapter) =>
                        chapter.id ===
                        chapterId
                          ? {
                              ...chapter,
                              title,
                            }
                          : chapter,
                    ),
                },
        ),
    },

    updatedAt:
      new Date().toISOString(),
  }))
}

// --------------------------------------------------
// Rename Scene
// --------------------------------------------------

export function renameScene(
  setProject: SetProject,
  actId: string,
  chapterId: string,
  sceneId: string,
  title: string,
) {
  setProject((current) => ({
    ...current,

    manuscript: {
      ...current.manuscript,

      acts:
        current.manuscript.acts.map(
          (act) =>
            act.id !== actId
              ? act
              : {
                  ...act,

                  chapters:
                    act.chapters.map(
                      (chapter) =>
                        chapter.id !==
                        chapterId
                          ? chapter
                          : {
                              ...chapter,

                              scenes:
                                chapter.scenes.map(
                                  (scene) =>
                                    scene.id ===
                                    sceneId
                                      ? {
                                          ...scene,
                                          title,
                                        }
                                      : scene,
                                ),
                            },
                    ),
                },
        ),
    },

    updatedAt:
      new Date().toISOString(),
  }))
}

// --------------------------------------------------
// Delete Act
// --------------------------------------------------

export function deleteAct(
  setProject: SetProject,
  actId: string,
) {
  setProject((current) => {
    const acts =
      current.manuscript.acts.filter(
        (act) =>
          act.id !== actId,
      )

    const activeStillExists =
      findScene(
        acts,
        current.settings
          .activeSceneId,
      ) !== null

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      settings: {
        ...current.settings,

        activeSceneId:
          activeStillExists
            ? current.settings
                .activeSceneId
            : findFirstSceneId(acts),
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Delete Chapter
// --------------------------------------------------

export function deleteChapter(
  setProject: SetProject,
  actId: string,
  chapterId: string,
) {
  setProject((current) => {
    const acts =
      current.manuscript.acts.map(
        (act) =>
          act.id !== actId
            ? act
            : {
                ...act,

                chapters:
                  act.chapters.filter(
                    (chapter) =>
                      chapter.id !==
                      chapterId,
                  ),
              },
      )

    const activeStillExists =
      findScene(
        acts,
        current.settings
          .activeSceneId,
      ) !== null

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      settings: {
        ...current.settings,

        activeSceneId:
          activeStillExists
            ? current.settings
                .activeSceneId
            : findFirstSceneId(acts),
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Delete Scene
// --------------------------------------------------

export function deleteScene(
  setProject: SetProject,
  actId: string,
  chapterId: string,
  sceneId: string,
) {
  setProject((current) => {
    const acts =
      current.manuscript.acts.map(
        (act) =>
          act.id !== actId
            ? act
            : {
                ...act,

                chapters:
                  act.chapters.map(
                    (chapter) =>
                      chapter.id !==
                      chapterId
                        ? chapter
                        : {
                            ...chapter,

                            scenes:
                              chapter.scenes.filter(
                                (scene) =>
                                  scene.id !==
                                  sceneId,
                              ),
                          },
                  ),
              },
      )

    const activeWasDeleted =
      current.settings
        .activeSceneId ===
      sceneId

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      settings: {
        ...current.settings,

        activeSceneId:
          activeWasDeleted
            ? findFirstSceneId(acts)
            : current.settings
                .activeSceneId,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Move Act
// --------------------------------------------------

export function moveAct(
  setProject: SetProject,
  fromIndex: number,
  toIndex: number,
) {
  setProject((current) => {
    const acts =
      [...current.manuscript.acts]

    if (
      fromIndex < 0 ||
      fromIndex >= acts.length ||
      toIndex < 0 ||
      toIndex >= acts.length
    ) {
      return current
    }

    const [moved] =
      acts.splice(
        fromIndex,
        1,
      )

    acts.splice(
      toIndex,
      0,
      moved,
    )

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Move Chapter
// --------------------------------------------------

export function moveChapter(
  setProject: SetProject,
  actId: string,
  fromIndex: number,
  toIndex: number,
) {
  setProject((current) => {
    const acts =
      current.manuscript.acts.map(
        (act) => {
          if (act.id !== actId) {
            return act
          }

          const chapters =
            [...act.chapters]

          if (
            fromIndex < 0 ||
            fromIndex >=
              chapters.length ||
            toIndex < 0 ||
            toIndex >=
              chapters.length
          ) {
            return act
          }

          const [moved] =
            chapters.splice(
              fromIndex,
              1,
            )

          chapters.splice(
            toIndex,
            0,
            moved,
          )

          return {
            ...act,
            chapters,
          }
        },
      )

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Move Scene
// --------------------------------------------------

export function moveScene(
  setProject: SetProject,
  actId: string,
  chapterId: string,
  fromIndex: number,
  toIndex: number,
) {
  setProject((current) => {
    const acts =
      current.manuscript.acts.map(
        (act) => {
          if (act.id !== actId) {
            return act
          }

          return {
            ...act,

            chapters:
              act.chapters.map(
                (chapter) => {
                  if (
                    chapter.id !==
                    chapterId
                  ) {
                    return chapter
                  }

                  const scenes =
                    [...chapter.scenes]

                  if (
                    fromIndex < 0 ||
                    fromIndex >=
                      scenes.length ||
                    toIndex < 0 ||
                    toIndex >=
                      scenes.length
                  ) {
                    return chapter
                  }

                  const [moved] =
                    scenes.splice(
                      fromIndex,
                      1,
                    )

                  scenes.splice(
                    toIndex,
                    0,
                    moved,
                  )

                  return {
                    ...chapter,
                    scenes,
                  }
                },
              ),
          }
        },
      )

    return {
      ...current,

      manuscript: {
        ...current.manuscript,
        acts,
      },

      updatedAt:
        new Date().toISOString(),
    }
  })
}

// --------------------------------------------------
// Editor
// --------------------------------------------------

export function updateSceneContent(
  setProject: SetProject,
  sceneId: string,
  content: JSONContent,
) {
  setProject((current) => ({
    ...current,

    manuscript: {
      ...current.manuscript,

      acts:
        current.manuscript.acts.map(
          (act) => ({
            ...act,

            chapters:
              act.chapters.map(
                (chapter) => ({
                  ...chapter,

                  scenes:
                    chapter.scenes.map(
                      (scene) =>
                        scene.id ===
                        sceneId
                          ? {
                              ...scene,
                              content,
                            }
                          : scene,
                    ),
                }),
              ),
          }),
        ),
    },

    updatedAt:
      new Date().toISOString(),
  }))
}
