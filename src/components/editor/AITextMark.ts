import { Mark } from "@tiptap/core"

export const AITextMark = Mark.create({
  name: "aiText",

  parseHTML() {
    return [
      {
        tag: "span.ai-generated-text",
      },
    ]
  },

  renderHTML() {
    return [
      "span",
      {
        class: "ai-generated-text",
      },
      0,
    ]
  },
})
