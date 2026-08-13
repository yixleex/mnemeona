import { useState } from "react"
import { FilePlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useProject } from "@/context/ProjectContext"

interface NewProjectDialogProps {
open: boolean
onOpenChange: (open: boolean) => void
}

export function NewProjectDialog({
open,
onOpenChange,
}: NewProjectDialogProps) {
const { createNewProject } = useProject()

const [title, setTitle] = useState("")

const handleCreate = () => {
const trimmedTitle = title.trim()


if (!trimmedTitle) {
  return
}

createNewProject(trimmedTitle)

setTitle("")
onOpenChange(false)


}

const handleOpenChange = (nextOpen: boolean) => {
onOpenChange(nextOpen)


if (!nextOpen) {
  setTitle("")
}


}

return ( <Dialog open={open} onOpenChange={handleOpenChange}> <DialogContent className="sm:max-w-md"> <DialogHeader> <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent"> <FilePlus className="size-5" /> </div>


      <DialogTitle>New Project</DialogTitle>

      <DialogDescription>
        Start a new novel, story, or writing project.
      </DialogDescription>
    </DialogHeader>

    <div className="py-4">
      <Label htmlFor="project-title">
        Project name
      </Label>

      <Input
        id="project-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleCreate()
          }
        }}
        placeholder="The Silent Forest"
        autoFocus
        className="mt-2"
      />
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => handleOpenChange(false)}
      >
        Cancel
      </Button>

      <Button
        disabled={!title.trim()}
        onClick={handleCreate}
      >
        Create Project
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


)
}
