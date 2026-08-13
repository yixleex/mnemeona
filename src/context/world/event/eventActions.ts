import type {
  Dispatch,
  SetStateAction,
} from "react"

import type { MnemeonaProject } from "@/types/project"
import type { WorldEvent } from "@/types/world/event"

import { createId } from "@/lib/project"

type SetProject = Dispatch<
  SetStateAction<MnemeonaProject>
>

// --------------------------------------------------
// Add Event
// --------------------------------------------------

export function addEvent(
  setProject: SetProject,
  event: Omit<
    WorldEvent,
    "id" | "createdAt" | "updatedAt"
  >,
): string {
  const now =
    new Date().toISOString()

  const newEvent: WorldEvent = {
    ...event,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  }

  setProject((current) => ({
    ...current,
    events: [
      ...current.events,
      newEvent,
    ],
    updatedAt: now,
  }))

  return newEvent.id
}

// --------------------------------------------------
// Update Event
// --------------------------------------------------

export function updateEvent(
  setProject: SetProject,
  eventId: string,
  updates: Partial<WorldEvent>,
): void {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    events: current.events.map(
      (event) =>
        event.id === eventId
          ? {
              ...event,
              ...updates,
              id: event.id,
              createdAt:
                event.createdAt,
              updatedAt: now,
            }
          : event,
    ),

    updatedAt: now,
  }))
}

// --------------------------------------------------
// Delete Event
// --------------------------------------------------

export function deleteEvent(
  setProject: SetProject,
  eventId: string,
): void {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    events: current.events.filter(
      (event) =>
        event.id !== eventId,
    ),

    updatedAt: now,
  }))
}
