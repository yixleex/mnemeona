import { useMemo, useState } from "react"

import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Globe2,
  MapPin,
  Package,
  Plus,
  Search,
  Shield,
  Sparkles,
  Users,
  WandSparkles,
  PawPrint,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"

import { EventDatabase } from "./events/EventDatabase"
import { LocationDatabase } from "./locations/LocationDatabase"

interface WorldDatabaseProps {
  onClose?: () => void
}

type WorldView =
  | "overview"
  | "locations"
  | "events"
  | "factions"
  | "artifacts"
  | "lore"
  | "cultures"
  | "creatures"
  | "systems"

interface WorldCategory {
  id: WorldView
  name: string
  description: string
  icon: typeof MapPin
}

const WORLD_CATEGORIES: WorldCategory[] = [
  {
    id: "locations",
    name: "Locations",
    description:
      "Places, regions, cities, landmarks, and important settings.",
    icon: MapPin,
  },
  {
    id: "events",
    name: "Events",
    description:
      "Historical events, battles, discoveries, disasters, and turning points.",
    icon: CalendarDays,
  },
  {
    id: "factions",
    name: "Factions",
    description:
      "Organizations, kingdoms, guilds, houses, religions, and groups.",
    icon: Shield,
  },
  {
    id: "artifacts",
    name: "Artifacts",
    description:
      "Important objects, weapons, relics, books, and technology.",
    icon: Package,
  },
  {
    id: "lore",
    name: "Lore",
    description:
      "Myths, legends, beliefs, historical truths, rumors, and world knowledge.",
    icon: BookOpen,
  },
  {
    id: "cultures",
    name: "Cultures",
    description:
      "Customs, traditions, values, languages, and social structures.",
    icon: Users,
  },
  {
    id: "creatures",
    name: "Creatures",
    description:
      "Species, monsters, animals, beings, and supernatural entities.",
    icon: PawPrint,
  },
  {
    id: "systems",
    name: "Magic & Technology",
    description:
      "Magic systems, technologies, sciences, supernatural rules, and systems.",
    icon: WandSparkles,
  },
]

export function WorldDatabase({
  onClose,
}: WorldDatabaseProps) {
  const { project } = useProject()

  const [activeView, setActiveView] =
    useState<WorldView>("overview")

  const [searchQuery, setSearchQuery] =
    useState("")

  // --------------------------------------------------
  // World Counts
  // --------------------------------------------------

  const locationCount =
    project.locations?.length ?? 0

  const eventCount =
    project.events?.length ?? 0

  const categoryCounts =
    useMemo(
      () => ({
        locations: locationCount,
        events: eventCount,
        factions: 0,
        artifacts: 0,
        lore: 0,
        cultures: 0,
        creatures: 0,
        systems: 0,
      }),
      [
        locationCount,
        eventCount,
      ],
    )

  const filteredCategories =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase()

      if (!query) {
        return WORLD_CATEGORIES
      }

      return WORLD_CATEGORIES.filter(
        (category) =>
          category.name
            .toLowerCase()
            .includes(query) ||
          category.description
            .toLowerCase()
            .includes(query),
      )
    }, [searchQuery])

  const totalEntries =
    WORLD_CATEGORIES.reduce(
      (total, category) =>
        total +
        categoryCounts[
          category.id
        ],
      0,
    )

  // --------------------------------------------------
  // Location View
  // --------------------------------------------------

  if (
    activeView ===
    "locations"
  ) {
    return (
      <LocationDatabase
        onClose={() =>
          setActiveView(
            "overview",
          )
        }
      />
    )
  }

  // --------------------------------------------------
  // Event View
  // --------------------------------------------------

  if (
    activeView ===
    "events"
  ) {
    return (
      <EventDatabase
        onClose={() =>
          setActiveView(
            "overview",
          )
        }
      />
    )
  }

  // --------------------------------------------------
  // World Overview
  // --------------------------------------------------

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}

      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe2 className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  World Database
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {totalEntries} entries
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Build and organize the world behind your story.
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

        {/* Search */}

        <div className="relative mt-5 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search the world..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
          {/* Quick Actions */}

          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                Quick Actions
              </h2>

              <p className="text-sm text-muted-foreground">
                Start building your world.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  setActiveView(
                    "locations",
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New Location
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setActiveView(
                    "events",
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New Event
              </Button>

              <Button
                variant="outline"
                disabled
              >
                <Plus className="mr-2 h-4 w-4" />
                New Faction
              </Button>

              <Button
                variant="outline"
                disabled
              >
                <Plus className="mr-2 h-4 w-4" />
                New Lore
              </Button>
            </div>
          </section>

          {/* Categories */}

          <section>
            <div className="mb-4">
              <h2 className="text-sm font-semibold">
                World Categories
              </h2>

              <p className="text-sm text-muted-foreground">
                Organize the people, places,
                history, and systems that make
                your world unique.
              </p>
            </div>

            {filteredCategories.length ===
            0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed">
                <Search className="mb-3 h-5 w-5 text-muted-foreground" />

                <p className="text-sm font-medium">
                  No categories found
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCategories.map(
                  (category) => {
                    const Icon =
                      category.icon

                    const isAvailable =
                      category.id ===
                        "locations" ||
                      category.id ===
                        "events"

                    const count =
                      categoryCounts[
                        category.id
                      ]

                    return (
                      <button
                        key={
                          category.id
                        }
                        type="button"
                        disabled={
                          !isAvailable
                        }
                        onClick={() => {
                          if (
                            category.id ===
                            "locations"
                          ) {
                            setActiveView(
                              "locations",
                            )
                          }

                          if (
                            category.id ===
                            "events"
                          ) {
                            setActiveView(
                              "events",
                            )
                          }
                        }}
                        className={`group flex min-h-40 flex-col rounded-xl border bg-card p-5 text-left transition-colors ${
                          isAvailable
                            ? "cursor-pointer hover:bg-muted/50"
                            : "cursor-default opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground ${
                              isAvailable
                                ? "transition-transform group-hover:translate-x-0.5"
                                : ""
                            }`}
                          />
                        </div>

                        <div className="mt-auto pt-6">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {
                                category.name
                              }
                            </h3>

                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {count}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {
                              category.description
                            }
                          </p>
                        </div>
                      </button>
                    )
                  },
                )}
              </div>
            )}
          </section>

          {/* AI Context */}

          <section>
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>

                <div>
                  <h2 className="font-medium">
                    AI World Context
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Everything you add to the
                    World Database can become
                    structured context for the AI.
                    Locations, events, factions,
                    artifacts, lore, cultures,
                    creatures, and systems can
                    eventually help the AI maintain
                    consistency throughout your story.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
