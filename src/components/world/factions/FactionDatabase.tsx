import { useMemo, useState } from "react"

import {
  ChevronDown,
  Crown,
  Flag,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"

import type { Character } from "@/types/character"
import type {
  Faction,
  FactionType,
} from "@/types/world/faction"
import type { Location } from "@/types/world/location"

interface FactionDatabaseProps {
  onClose?: () => void
}

const FACTION_TYPES: FactionType[] = [
  "Kingdom",
  "Empire",
  "Nation",
  "City-State",
  "Guild",
  "Company",
  "House",
  "Clan",
  "Tribe",
  "Religious Order",
  "Military",
  "Rebel Group",
  "Criminal Organization",
  "Secret Society",
  "Political Movement",
  "Academic Organization",
  "Other",
]

function getFactionIcon(
  type: FactionType,
) {
  switch (type) {
    case "Kingdom":
    case "Empire":
    case "Nation":
    case "City-State":
      return Crown

    case "Military":
    case "Rebel Group":
      return Shield

    case "Guild":
    case "Company":
    case "Academic Organization":
      return Users

    default:
      return Flag
  }
}

interface FactionEditorProps {
  faction: Faction | null
  characters: Character[]
  locations: Location[]
  onSave: (faction: Faction) => void
  onCancel: () => void
}

function FactionEditor({
  faction,
  characters,
  locations,
  onSave,
  onCancel,
}: FactionEditorProps) {
  const [name, setName] = useState(
    faction?.name ?? "",
  )

  const [type, setType] =
    useState<FactionType>(
      faction?.type ?? "Other",
    )

  const [description, setDescription] =
    useState(
      faction?.description ?? "",
    )

  const [leaderCharacterId, setLeaderCharacterId] =
    useState(
      faction?.leaderCharacterId ?? "",
    )

  const [
    headquartersLocationId,
    setHeadquartersLocationId,
  ] = useState(
    faction?.headquartersLocationId ??
      "",
  )

  const [goals, setGoals] =
    useState(
      faction?.goals ?? "",
    )

  const [values, setValues] =
    useState(
      faction?.values ?? "",
    )

  const [resources, setResources] =
    useState(
      faction?.resources ?? "",
    )

  const [allies, setAllies] =
    useState(
      faction?.allies ?? "",
    )

  const [enemies, setEnemies] =
    useState(
      faction?.enemies ?? "",
    )

  const [history, setHistory] =
    useState(
      faction?.history ?? "",
    )

  const [secrets, setSecrets] =
    useState(
      faction?.secrets ?? "",
    )

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const trimmedName =
      name.trim()

    if (!trimmedName) {
      return
    }

    const now =
      new Date().toISOString()

    onSave({
      id:
        faction?.id ??
        `faction-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      name: trimmedName,

      type,

      description:
        description.trim(),

      leaderCharacterId:
        leaderCharacterId ||
        undefined,

      headquartersLocationId:
        headquartersLocationId ||
        undefined,

      goals:
        goals.trim() || undefined,

      values:
        values.trim() || undefined,

      resources:
        resources.trim() || undefined,

      allies:
        allies.trim() || undefined,

      enemies:
        enemies.trim() || undefined,

      history:
        history.trim() || undefined,

      secrets:
        secrets.trim() || undefined,

      createdAt:
        faction?.createdAt ??
        now,

      updatedAt: now,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Name
          </label>

          <Input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            placeholder="The Silver Concord"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Type
          </label>

          <div className="relative">
            <select
              value={type}
              onChange={(event) =>
                setType(
                  event.target.value as FactionType,
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
            >
              {FACTION_TYPES.map(
                (factionType) => (
                  <option
                    key={factionType}
                    value={factionType}
                  >
                    {factionType}
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Description
        </label>

        <textarea
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value,
            )
          }
          placeholder="What is this faction and what role does it play in the world?"
          className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Leader + Headquarters */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Leader
          </label>

          {characters.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3">
              <div className="flex items-start gap-2">
                <Crown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                <div>
                  <p className="text-sm font-medium">
                    No characters yet
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a character first
                    to assign them as this
                    faction's leader.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <select
                value={
                  leaderCharacterId
                }
                onChange={(event) =>
                  setLeaderCharacterId(
                    event.target.value,
                  )
                }
                className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
              >
                <option value="">
                  No leader
                </option>

                {characters.map(
                  (character) => (
                    <option
                      key={character.id}
                      value={character.id}
                    >
                      {character.name}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Headquarters
          </label>

          {locations.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3">
              <div className="flex items-start gap-2">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                <div>
                  <p className="text-sm font-medium">
                    No locations yet
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a location first
                    to assign it as this
                    faction's headquarters.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <select
                value={
                  headquartersLocationId
                }
                onChange={(event) =>
                  setHeadquartersLocationId(
                    event.target.value,
                  )
                }
                className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
              >
                <option value="">
                  No headquarters
                </option>

                {locations.map(
                  (location) => (
                    <option
                      key={location.id}
                      value={location.id}
                    >
                      {location.name}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Goals
          </label>

          <textarea
            value={goals}
            onChange={(event) =>
              setGoals(
                event.target.value,
              )
            }
            placeholder="What does this faction want?"
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Values & Beliefs
          </label>

          <textarea
            value={values}
            onChange={(event) =>
              setValues(
                event.target.value,
              )
            }
            placeholder="What does this faction believe in?"
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Resources & Power
        </label>

        <textarea
          value={resources}
          onChange={(event) =>
            setResources(
              event.target.value,
            )
          }
          placeholder="Armies, wealth, magic, political influence, technology, territory, etc."
          className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Allies
          </label>

          <textarea
            value={allies}
            onChange={(event) =>
              setAllies(
                event.target.value,
              )
            }
            placeholder="Allied factions, people, or powers"
            className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Enemies
          </label>

          <textarea
            value={enemies}
            onChange={(event) =>
              setEnemies(
                event.target.value,
              )
            }
            placeholder="Rivals, enemies, or opposing powers"
            className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            History
          </label>

          <textarea
            value={history}
            onChange={(event) =>
              setHistory(
                event.target.value,
              )
            }
            placeholder="Important events and history"
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Secrets
          </label>

          <textarea
            value={secrets}
            onChange={(event) =>
              setSecrets(
                event.target.value,
              )
            }
            placeholder="Hidden information, conspiracies, forbidden knowledge, etc."
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button type="submit">
          {faction
            ? "Save Changes"
            : "Create Faction"}
        </Button>
      </div>
    </form>
  )
}

export function FactionDatabase({
  onClose,
}: FactionDatabaseProps) {
  const {
    project,
    updateProject,
  } = useProject()

  const factions =
    project.factions

  const characters =
    project.characters

  const locations =
    project.locations

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("")

  const [
    selectedType,
    setSelectedType,
  ] = useState<
    FactionType | "All"
  >("All")

  const [
    editingFaction,
    setEditingFaction,
  ] = useState<Faction | null>(
    null,
  )

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false)

  const filteredFactions =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase()

      return factions.filter(
        (faction) => {
          const leader =
            faction.leaderCharacterId
              ? characters.find(
                  (character) =>
                    character.id ===
                    faction.leaderCharacterId,
                )
              : undefined

          const headquarters =
            faction.headquartersLocationId
              ? locations.find(
                  (location) =>
                    location.id ===
                    faction.headquartersLocationId,
                )
              : undefined

          const matchesSearch =
            !query ||
            faction.name
              .toLowerCase()
              .includes(query) ||
            faction.description
              .toLowerCase()
              .includes(query) ||
            leader?.name
              .toLowerCase()
              .includes(query) ||
            headquarters?.name
              .toLowerCase()
              .includes(query) ||
            faction.goals
              ?.toLowerCase()
              .includes(query) ||
            faction.values
              ?.toLowerCase()
              .includes(query)

          const matchesType =
            selectedType === "All" ||
            faction.type ===
              selectedType

          return (
            matchesSearch &&
            matchesType
          )
        },
      )
    }, [
      factions,
      characters,
      locations,
      searchQuery,
      selectedType,
    ])

  const handleCreateFaction =
    () => {
      setEditingFaction(null)
      setEditorOpen(true)
    }

  const handleEditFaction = (
    faction: Faction,
  ) => {
    setEditingFaction(faction)
    setEditorOpen(true)
  }

  const handleSaveFaction = (
    faction: Faction,
  ) => {
    updateProject(
      (currentProject) => {
        const exists =
          currentProject.factions.some(
            (item) =>
              item.id === faction.id,
          )

        const nextFactions =
          exists
            ? currentProject.factions.map(
                (item) =>
                  item.id === faction.id
                    ? faction
                    : item,
              )
            : [
                ...currentProject.factions,
                faction,
              ]

        return {
          ...currentProject,

          factions:
            nextFactions,

          updatedAt:
            new Date().toISOString(),
        }
      },
    )

    setEditingFaction(null)
    setEditorOpen(false)
  }

  const handleDeleteFaction = (
    faction: Faction,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${faction.name}"? This cannot be undone.`,
      )

    if (!confirmed) {
      return
    }

    updateProject(
      (currentProject) => ({
        ...currentProject,

        factions:
          currentProject.factions.filter(
            (item) =>
              item.id !== faction.id,
          ),

        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  if (editorOpen) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Flag className="h-5 w-5 text-primary" />
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {editingFaction
                    ? "Edit Faction"
                    : "New Faction"}
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  Define an organization,
                  kingdom, guild, house,
                  religion, or other
                  power in your world.
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditorOpen(false)
                setEditingFaction(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl p-6">
            <FactionEditor
              faction={
                editingFaction
              }
              characters={
                characters
              }
              locations={
                locations
              }
              onSave={
                handleSaveFaction
              }
              onCancel={() => {
                setEditorOpen(false)
                setEditingFaction(null)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Flag className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  Factions
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {factions.length}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Organizations, kingdoms,
                guilds, houses, religions,
                and powers in your world.
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
              placeholder="Search factions..."
              className="pl-9"
            />
          </div>

          <div className="relative">
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value as
                    | FactionType
                    | "All",
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm sm:w-52"
            >
              <option value="All">
                All Types
              </option>

              {FACTION_TYPES.map(
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
              handleCreateFaction
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New Faction
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-6">
          {factions.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Flag className="h-6 w-6 text-muted-foreground" />
              </div>

              <h2 className="mt-4 text-base font-semibold">
                No factions yet
              </h2>

              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create a kingdom, guild,
                military order, secret
                society, religion, house,
                or any other important
                organization.
              </p>

              <Button
                className="mt-5"
                onClick={
                  handleCreateFaction
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Faction
              </Button>
            </div>
          ) : filteredFactions.length ===
            0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />

              <h2 className="mt-3 text-base font-semibold">
                No factions found
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Try changing your search
                or faction type filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFactions.map(
                (faction) => {
                  const Icon =
                    getFactionIcon(
                      faction.type,
                    )

                  const leader =
                    faction.leaderCharacterId
                      ? characters.find(
                          (character) =>
                            character.id ===
                            faction.leaderCharacterId,
                        )
                      : undefined

                  const headquarters =
                    faction.headquartersLocationId
                      ? locations.find(
                          (location) =>
                            location.id ===
                            faction.headquartersLocationId,
                        )
                      : undefined

                  return (
                    <div
                      key={faction.id}
                      className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-medium">
                              {faction.name}
                            </h3>

                            <span className="text-xs text-muted-foreground">
                              {faction.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {faction.description ||
                          "No description yet."}
                      </p>

                      <div className="mt-4 space-y-2 text-xs">
                        {leader ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Crown className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              Leader:{" "}
                              {leader.name}
                            </span>
                          </div>
                        ) : faction.leaderCharacterId ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Crown className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              Leader:
                              Character no
                              longer exists
                            </span>
                          </div>
                        ) : null}

                        {headquarters ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Flag className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              Headquarters:{" "}
                              {
                                headquarters.name
                              }
                            </span>
                          </div>
                        ) : faction.headquartersLocationId ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Flag className="h-3.5 w-3.5 shrink-0" />

                            <span className="truncate">
                              Headquarters:
                              Location no
                              longer exists
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {faction.goals && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium">
                            Goals
                          </p>

                          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {faction.goals}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-end gap-1 border-t pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleEditFaction(
                              faction,
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
                            handleDeleteFaction(
                              faction,
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
    </div>
  )
}
