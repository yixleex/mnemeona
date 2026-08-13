import { useMemo, useState } from "react"

import {
  Building2,
  ChevronDown,
  Globe2,
  Landmark,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trees,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useProject } from "@/context/ProjectContext"

import type {
  Location,
  LocationType,
} from "@/types/location"

import {
  NewLocationDialog,
} from "./NewLocationDialog"

interface LocationDatabaseProps {
  onClose?: () => void
}

const LOCATION_TYPES: LocationType[] = [
  "Continent",
  "Country",
  "Region",
  "City",
  "Town",
  "Village",
  "District",
  "Building",
  "Landmark",
  "Dungeon",
  "Battlefield",
  "Natural Feature",
  "Other",
]

function getLocationIcon(
  type: LocationType,
) {
  switch (type) {
    case "Continent":
    case "Country":
    case "Region":
      return Globe2

    case "City":
    case "Town":
    case "Village":
    case "District":
    case "Building":
      return Building2

    case "Landmark":
    case "Dungeon":
    case "Battlefield":
      return Landmark

    case "Natural Feature":
      return Mountain

    default:
      return MapPin
  }
}

export function LocationDatabase({
  onClose,
}: LocationDatabaseProps) {
  const {
    project,
    addLocation,
    updateLocation,
    deleteLocation,
  } = useProject()

  const locations =
    project.locations

  const [searchQuery, setSearchQuery] =
    useState("")

  const [selectedType, setSelectedType] =
    useState<LocationType | "All">("All")

  const [dialogOpen, setDialogOpen] =
    useState(false)

  const [editingLocation, setEditingLocation] =
    useState<Location | null>(null)

  const filteredLocations = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase()

    return locations.filter(
      (location) => {
        const matchesSearch =
          !query ||
          location.name
            .toLowerCase()
            .includes(query) ||
          location.description
            .toLowerCase()
            .includes(query) ||
          location.region
            ?.toLowerCase()
            .includes(query) ||
          location.significance
            ?.toLowerCase()
            .includes(query)

        const matchesType =
          selectedType === "All" ||
          location.type ===
            selectedType

        return (
          matchesSearch &&
          matchesType
        )
      },
    )
  }, [
    locations,
    searchQuery,
    selectedType,
  ])

  // --------------------------------------------------
  // Create
  // --------------------------------------------------

  const handleCreateLocation = () => {
    setEditingLocation(null)
    setDialogOpen(true)
  }

  // --------------------------------------------------
  // Edit
  // --------------------------------------------------

  const handleEditLocation = (
    location: Location,
  ) => {
    setEditingLocation(location)
    setDialogOpen(true)
  }

  // --------------------------------------------------
  // Save
  // --------------------------------------------------

  const handleSaveLocation = (
    location: Location,
  ) => {
    const exists =
      locations.some(
        (item) =>
          item.id === location.id,
      )

    if (exists) {
      updateLocation(
        location.id,
        {
          ...location,
        },
      )
    } else {
      addLocation({
        name: location.name,
        type: location.type,
        description:
          location.description,

        parentLocationId:
          location.parentLocationId,

        region:
          location.region,

        climate:
          location.climate,

        population:
          location.population,

        government:
          location.government,

        significance:
          location.significance,

        history:
          location.history,

        secrets:
          location.secrets,
      })
    }

    setEditingLocation(null)
    setDialogOpen(false)
  }

  // --------------------------------------------------
  // Delete
  // --------------------------------------------------

  const handleDeleteLocation = (
    location: Location,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${location.name}"? This cannot be undone.`,
      )

    if (!confirmed) {
      return
    }

    deleteLocation(
      location.id,
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  Locations
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {locations.length}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Places, regions, landmarks, and settings
                within your world.
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
              placeholder="Search locations..."
              className="pl-9"
            />
          </div>

          <div className="relative">
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value as
                    | LocationType
                    | "All",
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm sm:w-48"
            >
              <option value="All">
                All Types
              </option>

              {LOCATION_TYPES.map(
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
              handleCreateLocation
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Location
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-6">
          {locations.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>

              <h2 className="mt-4 text-base font-semibold">
                No locations yet
              </h2>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Start building your world by creating a
                city, kingdom, landmark, region, or any
                other important place.
              </p>

              <Button
                className="mt-5"
                onClick={
                  handleCreateLocation
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Location
              </Button>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />

              <h2 className="mt-3 text-base font-semibold">
                No locations found
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search or location
                type filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLocations.map(
                (location) => {
                  const Icon =
                    getLocationIcon(
                      location.type,
                    )

                  return (
                    <div
                      key={location.id}
                      className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-medium">
                              {location.name}
                            </h3>

                            <span className="text-xs text-muted-foreground">
                              {location.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {location.description ||
                          "No description yet."}
                      </p>

                      {/* Metadata */}
                      <div className="mt-4 space-y-2 text-xs">
                        {location.region && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe2 className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              {location.region}
                            </span>
                          </div>
                        )}

                        {location.climate && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Trees className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              {location.climate}
                            </span>
                          </div>
                        )}

                        {location.population && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              Population:{" "}
                              {location.population}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Significance */}
                      {location.significance && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium">
                            Significance
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {
                              location.significance
                            }
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-5 flex items-center justify-end gap-1 border-t pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleEditLocation(
                              location,
                            )
                          }
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            handleDeleteLocation(
                              location,
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <NewLocationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)

          if (!open) {
            setEditingLocation(null)
          }
        }}
        location={editingLocation}
        onCreate={handleSaveLocation}
      />
    </div>
  )
}
