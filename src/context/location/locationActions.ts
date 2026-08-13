import type {
  Dispatch,
  SetStateAction,
} from "react"

import type { MnemeonaProject } from "@/types/project"
import type { Location } from "@/types/location"

import { createId } from "@/lib/project"

type SetProject = Dispatch<
  SetStateAction<MnemeonaProject>
>

// --------------------------------------------------
// Add Location
// --------------------------------------------------

export function addLocation(
  setProject: SetProject,
  location: Omit<
    Location,
    "id" | "createdAt" | "updatedAt"
  >,
): string {
  const now =
    new Date().toISOString()

  const newLocation: Location = {
    ...location,

    id: createId(),

    createdAt: now,
    updatedAt: now,
  }

  setProject((current) => ({
    ...current,

    locations: [
      ...current.locations,
      newLocation,
    ],

    updatedAt: now,
  }))

  return newLocation.id
}

// --------------------------------------------------
// Update Location
// --------------------------------------------------

export function updateLocation(
  setProject: SetProject,
  locationId: string,
  updates: Partial<Location>,
): void {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    locations: current.locations.map(
      (location) =>
        location.id === locationId
          ? {
              ...location,
              ...updates,
              id: location.id,
              createdAt:
                location.createdAt,
              updatedAt: now,
            }
          : location,
    ),

    updatedAt: now,
  }))
}

// --------------------------------------------------
// Delete Location
// --------------------------------------------------

export function deleteLocation(
  setProject: SetProject,
  locationId: string,
): void {
  const now =
    new Date().toISOString()

  setProject((current) => ({
    ...current,

    locations:
      current.locations.filter(
        (location) =>
          location.id !== locationId,
      ),

    updatedAt: now,
  }))
}
