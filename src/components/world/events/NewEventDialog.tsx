import {
  useEffect,
  useState,
} from "react"

import {
  CalendarDays,
} from "lucide-react"

import {
  Button,
} from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Input,
} from "@/components/ui/input"

import {
  Label,
} from "@/components/ui/label"

import {
  Textarea,
} from "@/components/ui/textarea"

import type {
  WorldEvent,
  WorldEventType,
} from "@/types/world/event"

interface NewEventDialogProps {
  open: boolean
  onOpenChange: (
    open: boolean,
  ) => void
  onCreate: (
    event: WorldEvent,
  ) => void
  event?: WorldEvent | null
}

const EVENT_TYPES: WorldEventType[] = [
  "Historical",
  "Political",
  "Military",
  "Religious",
  "Social",
  "Natural",
  "Personal",
  "Discovery",
  "Festival",
  "Crime",
  "Other",
]

const EMPTY_EVENT: WorldEvent = {
  id: "",
  name: "",
  type: "Historical",
  description: "",
  date: "",
  locationId: "",
  significance: "",
  history: "",
  consequences: "",
  secrets: "",
  createdAt: "",
  updatedAt: "",
}

export function NewEventDialog({
  open,
  onOpenChange,
  onCreate,
  event,
}: NewEventDialogProps) {
  const [
    form,
    setForm,
  ] = useState<WorldEvent>(
    EMPTY_EVENT,
  )

  const isEditing =
    Boolean(event)

  useEffect(() => {
    if (event) {
      setForm({
        ...event,
      })
    } else {
      setForm({
        ...EMPTY_EVENT,
      })
    }
  }, [event, open])

  const updateField = <
    K extends keyof WorldEvent,
  >(
    field: K,
    value: WorldEvent[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSubmit = (
    submitEvent: React.FormEvent,
  ) => {
    submitEvent.preventDefault()

    const name =
      form.name.trim()

    if (!name) {
      return
    }

    onCreate({
      ...form,
      name,
      description:
        form.description.trim(),
      date:
        form.date?.trim() || undefined,
      locationId:
        form.locationId?.trim() ||
        undefined,
      significance:
        form.significance?.trim() ||
        undefined,
      history:
        form.history?.trim() ||
        undefined,
      consequences:
        form.consequences?.trim() ||
        undefined,
      secrets:
        form.secrets?.trim() ||
        undefined,
    })
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />

            {isEditing
              ? "Edit Event"
              : "New Event"}
          </DialogTitle>

          <DialogDescription>
            {isEditing
              ? "Update the details of this world event."
              : "Create an event that exists within your world's history."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5"
        >
          {/* Name */}

          <div className="space-y-2">
            <Label htmlFor="event-name">
              Name
            </Label>

            <Input
              id="event-name"
              value={form.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value,
                )
              }
              placeholder="The Battle of Greyhaven"
              autoFocus
            />
          </div>

          {/* Type / Date */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-type">
                Type
              </Label>

              <select
                id="event-type"
                value={form.type}
                onChange={(event) =>
                  updateField(
                    "type",
                    event.target.value as WorldEventType,
                  )
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {EVENT_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date">
                Date
              </Label>

              <Input
                id="event-date"
                value={
                  form.date ?? ""
                }
                onChange={(event) =>
                  updateField(
                    "date",
                    event.target.value,
                  )
                }
                placeholder="12th Day of Frost, 1247"
              />

              <p className="text-xs text-muted-foreground">
                Use any format that fits your world's calendar.
              </p>
            </div>
          </div>

          {/* Description */}

          <div className="space-y-2">
            <Label htmlFor="event-description">
              Description
            </Label>

            <Textarea
              id="event-description"
              value={
                form.description
              }
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value,
                )
              }
              placeholder="Describe what happened during this event..."
              rows={4}
            />
          </div>

          {/* Location */}

          <div className="space-y-2">
            <Label htmlFor="event-location">
              Location ID
            </Label>

            <Input
              id="event-location"
              value={
                form.locationId ?? ""
              }
              onChange={(event) =>
                updateField(
                  "locationId",
                  event.target.value,
                )
              }
              placeholder="Location ID"
            />

            <p className="text-xs text-muted-foreground">
              This will later be connected to the Location database.
            </p>
          </div>

          {/* Significance */}

          <div className="space-y-2">
            <Label htmlFor="event-significance">
              Significance
            </Label>

            <Textarea
              id="event-significance"
              value={
                form.significance ?? ""
              }
              onChange={(event) =>
                updateField(
                  "significance",
                  event.target.value,
                )
              }
              placeholder="Why is this event important?"
              rows={3}
            />
          </div>

          {/* History */}

          <div className="space-y-2">
            <Label htmlFor="event-history">
              History
            </Label>

            <Textarea
              id="event-history"
              value={
                form.history ?? ""
              }
              onChange={(event) =>
                updateField(
                  "history",
                  event.target.value,
                )
              }
              placeholder="What led to this event? What happened during it?"
              rows={3}
            />
          </div>

          {/* Consequences */}

          <div className="space-y-2">
            <Label htmlFor="event-consequences">
              Consequences
            </Label>

            <Textarea
              id="event-consequences"
              value={
                form.consequences ?? ""
              }
              onChange={(event) =>
                updateField(
                  "consequences",
                  event.target.value,
                )
              }
              placeholder="What changed as a result of this event?"
              rows={3}
            />
          </div>

          {/* Secrets */}

          <div className="space-y-2">
            <Label htmlFor="event-secrets">
              Secrets
            </Label>

            <Textarea
              id="event-secrets"
              value={
                form.secrets ?? ""
              }
              onChange={(event) =>
                updateField(
                  "secrets",
                  event.target.value,
                )
              }
              placeholder="Hidden information about this event..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={
                handleClose
              }
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={
                !form.name.trim()
              }
            >
              {isEditing
                ? "Save Changes"
                : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
