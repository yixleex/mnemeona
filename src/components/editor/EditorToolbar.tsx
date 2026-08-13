import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import {
Bold,
Italic,
Underline,
Strikethrough,
List,
ListOrdered,
Quote,
Minus,
Undo2,
Redo2,
ChevronDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EditorToolbarProps {
editor: Editor
}

type TextStyle =
| "paragraph"
| "heading1"
| "heading2"
| "heading3"
| "blockquote"

interface ToolbarState {
isBold: boolean
isItalic: boolean
isUnderline: boolean
isStrike: boolean
isBulletList: boolean
isOrderedList: boolean
isBlockquote: boolean
isHeading1: boolean
isHeading2: boolean
isHeading3: boolean
canUndo: boolean
canRedo: boolean
}

const textStyles: {
label: string
value: TextStyle
}[] = [
{ label: "Normal", value: "paragraph" },
{ label: "Heading 1", value: "heading1" },
{ label: "Heading 2", value: "heading2" },
{ label: "Heading 3", value: "heading3" },
{ label: "Quote", value: "blockquote" },
]

function getToolbarState(editor: Editor): ToolbarState {
return {
isBold: editor.isActive("bold"),
isItalic: editor.isActive("italic"),
isUnderline: editor.isActive("underline"),
isStrike: editor.isActive("strike"),


isBulletList: editor.isActive("bulletList"),
isOrderedList: editor.isActive("orderedList"),
isBlockquote: editor.isActive("blockquote"),

isHeading1: editor.isActive("heading", { level: 1 }),
isHeading2: editor.isActive("heading", { level: 2 }),
isHeading3: editor.isActive("heading", { level: 3 }),

canUndo: editor.can().undo(),
canRedo: editor.can().redo(),


}
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
const [state, setState] = useState<ToolbarState>(() =>
getToolbarState(editor),
)

useEffect(() => {
const update = () => {
setState(getToolbarState(editor))
}


editor.on("selectionUpdate", update)
editor.on("transaction", update)

return () => {
  editor.off("selectionUpdate", update)
  editor.off("transaction", update)
}


}, [editor])

const activeStyle = state.isHeading1
? "Heading 1"
: state.isHeading2
? "Heading 2"
: state.isHeading3
? "Heading 3"
: state.isBlockquote
? "Quote"
: "Normal"

const applyStyle = (style: TextStyle) => {
const chain = editor.chain().focus()


switch (style) {
  case "paragraph":
    chain.setParagraph().run()
    break

  case "heading1":
    chain.setHeading({ level: 1 }).run()
    break

  case "heading2":
    chain.setHeading({ level: 2 }).run()
    break

  case "heading3":
    chain.setHeading({ level: 3 }).run()
    break

  case "blockquote":
    chain.setBlockquote().run()
    break
}


}

return ( <div className="flex h-11 shrink-0 items-center gap-0.5 border-b bg-background px-3">
{/* History */} <div className="flex items-center">
<Button
variant="ghost"
size="icon"
className="size-8"
disabled={!state.canUndo}
onClick={() => editor.chain().focus().undo().run()}
title="Undo"
> <Undo2 className="size-4" /> </Button>


    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={!state.canRedo}
      onClick={() => editor.chain().focus().redo().run()}
      title="Redo"
    >
      <Redo2 className="size-4" />
    </Button>
  </div>

  <div className="mx-2 h-5 w-px bg-border" />

  {/* Text style */}
  <DropdownMenu>
    <DropdownMenuTrigger
        className="inline-flex h-8 min-w-28 items-center justify-between rounded-lg px-2.5 text-sm font-normal outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{activeStyle}</span>
        <ChevronDown className="ml-2 size-3.5 opacity-60" />
      </DropdownMenuTrigger>

    <DropdownMenuContent align="start" className="w-36">
      {textStyles.map((style) => (
        <DropdownMenuItem
          key={style.value}
          onClick={() => applyStyle(style.value)}
          className={
            activeStyle === style.label ? "bg-accent" : undefined
          }
        >
          {style.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>

  <div className="mx-2 h-5 w-px bg-border" />

  {/* Text formatting */}
  <div className="flex items-center">
    <Button
      variant={state.isBold ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() => editor.chain().focus().toggleBold().run()}
      title="Bold"
    >
      <Bold className="size-4" />
    </Button>

    <Button
      variant={state.isItalic ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() => editor.chain().focus().toggleItalic().run()}
      title="Italic"
    >
      <Italic className="size-4" />
    </Button>

    <Button
      variant={state.isUnderline ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() => editor.chain().focus().toggleUnderline().run()}
      title="Underline"
    >
      <Underline className="size-4" />
    </Button>

    <Button
      variant={state.isStrike ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() => editor.chain().focus().toggleStrike().run()}
      title="Strikethrough"
    >
      <Strikethrough className="size-4" />
    </Button>
  </div>

  <div className="mx-2 h-5 w-px bg-border" />

  {/* Lists and blocks */}
  <div className="flex items-center">
    <Button
      variant={state.isBulletList ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() =>
        editor.chain().focus().toggleBulletList().run()
      }
      title="Bullet list"
    >
      <List className="size-4" />
    </Button>

    <Button
      variant={state.isOrderedList ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() =>
        editor.chain().focus().toggleOrderedList().run()
      }
      title="Numbered list"
    >
      <ListOrdered className="size-4" />
    </Button>

    <Button
      variant={state.isBlockquote ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      onClick={() =>
        editor.chain().focus().toggleBlockquote().run()
      }
      title="Blockquote"
    >
      <Quote className="size-4" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() =>
        editor.chain().focus().setHorizontalRule().run()
      }
      title="Horizontal rule"
    >
      <Minus className="size-4" />
    </Button>
  </div>
</div>


)
}
