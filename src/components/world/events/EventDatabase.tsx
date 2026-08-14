import { useMemo, useState } from "react"

import {
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"

import type {
  WorldEvent,
  WorldEventType,
} from "@/types/world/event"

import {
  WorldEventDialog,
} from "./WorldEventDialog"

interface EventDatabaseProps {
  onClose?: () => void
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

function getEventIcon(type: WorldEventType) {
  switch (type) {
    case "Military":
    case "Political":
    case "Historical":
      return CalendarDays

    case "Natural":
      return Clock

    case "Personal":
    case "Social":
    case "Religious":
    case "Festival":
    case "Discovery":
    case "Crime":
    case "Other":
    default:
      return CalendarDays
  }
}

export function EventDatabase({
  onClose,
}: EventDatabaseProps) {
  const {
    project,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useProject()

  const events = project.events ?? []

  const [searchQuery, setSearchQuery] =
    useState("")

  const [selectedType, setSelectedType] =
    useState<WorldEventType | "All">("All")

  const [dialogOpen, setDialogOpen] =
    useState(false)

  const [editingEvent, setEditingEvent] =
    useState<WorldEvent | null>(null)

  const filteredEvents = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase()

    return events.filter(
      (event) => {
        const matchesSearch =
          !query ||
          event.name
            .toLowerCase()
            .includes(query) ||
          event.description
            .toLowerCase()
            .includes(query) ||
          event.date
            ?.toLowerCase()
            .includes(query) ||
          event.significance
            ?.toLowerCase()
            .includes(query) ||
          event.history
            ?.toLowerCase()
            .includes(query) ||
          event.consequences
            ?.toLowerCase()
            .includes(query) ||
          event.secrets
            ?.toLowerCase()
            .includes(query)

        const matchesType =
          selectedType === "All" ||
          event.type === selectedType

        return (
          matchesSearch &&
          matchesType
        )
      },
    )
  }, [
    events,
    searchQuery,
    selectedType,
  ])

  // --------------------------------------------------
  // Create
  // --------------------------------------------------

  const handleCreateEvent = () => {
    setEditingEvent(null)
    setDialogOpen(true)
  }

  // --------------------------------------------------
  // Edit
  // --------------------------------------------------

  const handleEditEvent = (
    event: WorldEvent,
  ) => {
    setEditingEvent(event)
    setDialogOpen(true)
  }

  // --------------------------------------------------
  // Save
  // --------------------------------------------------

  const handleSaveEvent = (
    event: WorldEvent,
  ) => {
    const exists =
      events.some(
        (item) =>
          item.id === event.id,
      )

    if (exists) {
      updateEvent(
        event.id,
        {
          ...event,
        },
      )
    } else {
      addEvent({
        name: event.name,
        type: event.type,
        aliases: event.aliases,
        description:
          event.description,
        date: event.date,
        locationId:
          event.locationId,
        significance:
          event.significance,
        history:
          event.history,
        consequences:
          event.consequences,
        secrets:
          event.secrets,
      })
    }

    setEditingEvent(null)
    setDialogOpen(false)
  }

  // --------------------------------------------------
  // Delete
  // --------------------------------------------------

  const handleDeleteEvent = (
    event: WorldEvent,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${event.name}"? This cannot be undone.`,
      )

    if (!confirmed) {
      return
    }

    deleteEvent(event.id)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}

      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  Events
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {events.length}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Historical events, battles, discoveries,
                disasters, and turning points within your world.
              </p>
            </div>
          </div>

          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>

        {/* Search / Filters */}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search events..."
              className="pl-9"
            />
          </div>

          <div className="relative">
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value as
                    | WorldEventType
                    | "All",
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm sm:w-48"
            >
              <option value="All">
                All Types
              </option>

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

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <Button
            onClick={
              handleCreateEvent
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Content */}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-6">
          {events.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>

              <h2 className="mt-4 text-base font-semibold">
                No events yet
              </h2>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Start building your world's history by
                creating a battle, discovery, disaster,
                festival, political event, or other
                significant occurrence.
              </p>

              <Button
                className="mt-5"
                onClick={
                  handleCreateEvent
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Event
              </Button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />

              <h2 className="mt-3 text-base font-semibold">
                No events found
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search or event type filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map(
                (event) => {
                  const Icon =
                    getEventIcon(
                      event.type,
                    )

                  return (
                    <div
                      key={event.id}
                      className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
                    >
                      {/* Card Header */}

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {event.name}
                            </h3>

                            <span className="text-xs text-muted-foreground">
                              {event.type}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleEditEvent(
                                event,
                              )
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDeleteEvent(
                                event,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Description */}

                      <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">
                        {event.description ||
                          "No description provided."}
                      </p>

                      {/* Metadata */}

                      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                        {event.date && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {event.date}
                            </span>
                          </div>
                        )}

                        {event.locationId && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {event.locationId}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Significance */}

                      {event.significance && (
                        <div className="mt-4 rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Significance
                          </p>

                          <p className="mt-1 line-clamp-2 text-sm">
                            {event.significance}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                },
              )}
            </div>
          )}
        </div>
      </div>

      <WorldEventDialog
        open={dialogOpen}
        onOpenChange={
          setDialogOpen
        }
        onCreate={
          handleSaveEvent
        }
        event={
          editingEvent
        }
      />
    </div>
  )
}
