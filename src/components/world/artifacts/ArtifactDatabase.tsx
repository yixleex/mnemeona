import { useMemo, useState } from "react"

import {
  ChevronDown,
  ChevronLeft,
  Crown,
  Edit,
  MapPin,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"

import type { Character } from "@/types/character"
import type {
  Artifact,
  ArtifactType,
} from "@/types/world/artifact"
import type { Location } from "@/types/world/location"

interface ArtifactDatabaseProps {
  onClose?: () => void
}

const ARTIFACT_TYPES: ArtifactType[] = [
  "Weapon",
  "Armor",
  "Relic",
  "Book",
  "Tool",
  "Jewelry",
  "Technology",
  "Magical Object",
  "Key",
  "Other",
]

interface ArtifactEditorProps {
  artifact: Artifact | null
  characters: Character[]
  locations: Location[]
  onSave: (artifact: Artifact) => void
  onCancel: () => void
}

function ArtifactEditor({
  artifact,
  characters,
  locations,
  onSave,
  onCancel,
}: ArtifactEditorProps) {
  const [name, setName] =
    useState(
      artifact?.name ?? "",
    )

  const [aliases, setAliases] =
    useState<string[]>(
      artifact?.aliases ?? [],
    )

  const [type, setType] =
    useState<ArtifactType>(
      artifact?.type ?? "Other",
    )

  const [description, setDescription] =
    useState(
      artifact?.description ?? "",
    )

  const [ownerCharacterId, setOwnerCharacterId] =
    useState(
      artifact?.ownerCharacterId ?? "",
    )

  const [locationId, setLocationId] =
    useState(
      artifact?.locationId ?? "",
    )

  const [powers, setPowers] =
    useState(
      artifact?.powers ?? "",
    )

  const [abilities, setAbilities] =
    useState(
      artifact?.abilities ?? "",
    )

  const [appearance, setAppearance] =
    useState(
      artifact?.appearance ?? "",
    )

  const [history, setHistory] =
    useState(
      artifact?.history ?? "",
    )

  const [significance, setSignificance] =
    useState(
      artifact?.significance ?? "",
    )

  const [secrets, setSecrets] =
    useState(
      artifact?.secrets ?? "",
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

    /*
     * Clean aliases before saving:
     * - trim whitespace
     * - remove empty aliases
     * - remove duplicates case-insensitively
     * - don't save the artifact's canonical name as an alias
     */
    const cleanedAliases: string[] = []

    const seenAliases =
      new Set<string>()

    for (const alias of aliases) {
      const trimmedAlias =
        alias.trim()

      if (!trimmedAlias) {
        continue
      }

      const normalizedAlias =
        trimmedAlias.toLocaleLowerCase()

      const normalizedName =
        trimmedName.toLocaleLowerCase()

      if (
        normalizedAlias ===
        normalizedName
      ) {
        continue
      }

      if (
        seenAliases.has(
          normalizedAlias,
        )
      ) {
        continue
      }

      seenAliases.add(
        normalizedAlias,
      )

      cleanedAliases.push(
        trimmedAlias,
      )
    }

    onSave({
      id:
        artifact?.id ??
        `artifact-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      name: trimmedName,

      aliases:
        cleanedAliases,

      type,

      description:
        description.trim(),

      ownerCharacterId:
        ownerCharacterId ||
        undefined,

      locationId:
        locationId ||
        undefined,

      powers:
        powers.trim() ||
        undefined,

      abilities:
        abilities.trim() ||
        undefined,

      appearance:
        appearance.trim() ||
        undefined,

      history:
        history.trim() ||
        undefined,

      significance:
        significance.trim() ||
        undefined,

      secrets:
        secrets.trim() ||
        undefined,

      createdAt:
        artifact?.createdAt ??
        now,

      updatedAt: now,
    })
  }

  const aliasesText =
    aliases.join(", ")

  const handleAliasesChange = (
    value: string,
  ) => {
    const parsedAliases =
      value
        .split(",")
        .map(
          (alias) =>
            alias.trim(),
        )
        .filter(Boolean)

    setAliases(
      parsedAliases,
    )
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
            placeholder="The Crown of Ashes"
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
                  event.target.value as ArtifactType,
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
            >
              {ARTIFACT_TYPES.map(
                (artifactType) => (
                  <option
                    key={artifactType}
                    value={artifactType}
                  >
                    {artifactType}
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
          Aliases
        </label>

        <Input
          value={aliasesText}
          onChange={(event) =>
            handleAliasesChange(
              event.target.value,
            )
          }
          placeholder="Royal Blade, King's Sword, Kingsblade"
        />

        <p className="text-xs text-muted-foreground">
          Alternative names or titles this artifact
          may be called in your story. Separate
          multiple aliases with commas. The AI
          context system will recognize these as
          references to this artifact.
        </p>

        {aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {aliases.map(
              (alias, index) => (
                <span
                  key={`${alias}-${index}`}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {alias}
                </span>
              ),
            )}
          </div>
        )}
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
          placeholder="What is this artifact and why is it important?"
          className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Current Owner
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
                    to assign them as the
                    artifact's owner.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <select
                value={ownerCharacterId}
                onChange={(event) =>
                  setOwnerCharacterId(
                    event.target.value,
                  )
                }
                className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
              >
                <option value="">
                  No known owner
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
            Location
          </label>

          {locations.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                <div>
                  <p className="text-sm font-medium">
                    No locations yet
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a location first
                    to assign where the
                    artifact is kept.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <select
                value={locationId}
                onChange={(event) =>
                  setLocationId(
                    event.target.value,
                  )
                }
                className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
              >
                <option value="">
                  Unknown location
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
            Powers
          </label>

          <textarea
            value={powers}
            onChange={(event) =>
              setPowers(
                event.target.value,
              )
            }
            placeholder="Magical or supernatural powers"
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Abilities
          </label>

          <textarea
            value={abilities}
            onChange={(event) =>
              setAbilities(
                event.target.value,
              )
            }
            placeholder="Special functions, abilities, effects, or uses"
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Appearance
        </label>

        <textarea
          value={appearance}
          onChange={(event) =>
            setAppearance(
              event.target.value,
            )
          }
          placeholder="Physical appearance, materials, markings, inscriptions, etc."
          className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
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
            placeholder="Where did it come from? Who created or possessed it?"
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Significance
          </label>

          <textarea
            value={significance}
            onChange={(event) =>
              setSignificance(
                event.target.value,
              )
            }
            placeholder="Why does this artifact matter to the world or story?"
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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
          placeholder="Hidden powers, true origins, curses, unknown history, etc."
          className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
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
          {artifact
            ? "Save Changes"
            : "Create Artifact"}
        </Button>
      </div>
    </form>
  )
}

export function ArtifactDatabase({
  onClose,
}: ArtifactDatabaseProps) {
  const {
    project,
    updateProject,
  } = useProject()

  const artifacts =
    project.artifacts ?? []

  const characters =
    project.characters ?? []

  const locations =
    project.locations ?? []

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("")

  const [
    selectedType,
    setSelectedType,
  ] = useState<
    ArtifactType | "All"
  >("All")

  const [
    editingArtifact,
    setEditingArtifact,
  ] = useState<Artifact | null>(
    null,
  )

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false)

  const filteredArtifacts =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase()

      return artifacts.filter(
        (artifact) => {
          const owner =
            artifact.ownerCharacterId
              ? characters.find(
                  (character) =>
                    character.id ===
                    artifact.ownerCharacterId,
                )
              : undefined

          const location =
            artifact.locationId
              ? locations.find(
                  (location) =>
                    location.id ===
                    artifact.locationId,
                )
              : undefined

          const matchesSearch =
            !query ||
            artifact.name
              .toLowerCase()
              .includes(query) ||
            (artifact.aliases ??
              []
            ).some((alias) =>
              alias
                .toLowerCase()
                .includes(query),
            ) ||
            artifact.description
              .toLowerCase()
              .includes(query) ||
            artifact.powers
              ?.toLowerCase()
              .includes(query) ||
            artifact.abilities
              ?.toLowerCase()
              .includes(query) ||
            artifact.history
              ?.toLowerCase()
              .includes(query) ||
            artifact.significance
              ?.toLowerCase()
              .includes(query) ||
            artifact.secrets
              ?.toLowerCase()
              .includes(query) ||
            owner?.name
              .toLowerCase()
              .includes(query) ||
            location?.name
              .toLowerCase()
              .includes(query)

          const matchesType =
            selectedType === "All" ||
            artifact.type ===
              selectedType

          return (
            matchesSearch &&
            matchesType
          )
        },
      )
    }, [
      artifacts,
      characters,
      locations,
      searchQuery,
      selectedType,
    ])

  const openNewArtifact = () => {
    setEditingArtifact(null)
    setEditorOpen(true)
  }

  const openEditArtifact = (
    artifact: Artifact,
  ) => {
    setEditingArtifact(artifact)
    setEditorOpen(true)
  }

  const handleSave = (
    artifact: Artifact,
  ) => {
    updateProject(
      (currentProject) => {
        const currentArtifacts =
          currentProject.artifacts ??
          []

        const exists =
          currentArtifacts.some(
            (item) =>
              item.id ===
              artifact.id,
          )

        return {
          ...currentProject,

          artifacts: exists
            ? currentArtifacts.map(
                (item) =>
                  item.id ===
                  artifact.id
                    ? artifact
                    : item,
              )
            : [
                ...currentArtifacts,
                artifact,
              ],

          updatedAt:
            new Date().toISOString(),
        }
      },
    )

    setEditorOpen(false)
    setEditingArtifact(null)
  }

  const handleDelete = (
    artifact: Artifact,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${artifact.name}"?\n\nThis cannot be undone.`,
      )

    if (!confirmed) {
      return
    }

    updateProject(
      (currentProject) => ({
        ...currentProject,

        artifacts: (
          currentProject.artifacts ??
          []
        ).filter(
          (item) =>
            item.id !==
            artifact.id,
        ),

        updatedAt:
          new Date().toISOString(),
      }),
    )
  }

  const getOwnerName = (
    artifact: Artifact,
  ) => {
    if (
      !artifact.ownerCharacterId
    ) {
      return null
    }

    return characters.find(
      (character) =>
        character.id ===
        artifact.ownerCharacterId,
    )?.name
  }

  const getLocationName = (
    artifact: Artifact,
  ) => {
    if (!artifact.locationId) {
      return null
    }

    return locations.find(
      (location) =>
        location.id ===
        artifact.locationId,
    )?.name
  }

  if (editorOpen) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditorOpen(false)
                setEditingArtifact(null)
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            <div className="h-5 w-px bg-border" />

            <div>
              <h1 className="text-lg font-semibold">
                {editingArtifact
                  ? "Edit Artifact"
                  : "New Artifact"}
              </h1>

              <p className="text-sm text-muted-foreground">
                Define an important object in your world.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl p-6">
            <ArtifactEditor
              artifact={
                editingArtifact
              }
              characters={
                characters
              }
              locations={
                locations
              }
              onSave={
                handleSave
              }
              onCancel={() => {
                setEditorOpen(false)
                setEditingArtifact(null)
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
              <Package className="h-5 w-5 text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  Artifacts
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {artifacts.length}{" "}
                  {artifacts.length === 1
                    ? "artifact"
                    : "artifacts"}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Important objects, relics, weapons, books, and technology.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={
                openNewArtifact
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New Artifact
            </Button>

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
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Search artifacts..."
              className="pl-9"
            />
          </div>

          <div className="relative sm:w-56">
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value as
                    | ArtifactType
                    | "All",
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
            >
              <option value="All">
                All types
              </option>

              {ARTIFACT_TYPES.map(
                (artifactType) => (
                  <option
                    key={artifactType}
                    value={artifactType}
                  >
                    {artifactType}
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-6">
          {filteredArtifacts.length ===
          0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed">
              <Package className="mb-3 h-8 w-8 text-muted-foreground" />

              <p className="text-sm font-medium">
                {artifacts.length === 0
                  ? "No artifacts yet"
                  : "No artifacts found"}
              </p>

              <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                {artifacts.length === 0
                  ? "Create your first artifact to start building the important objects in your world."
                  : "Try changing your search or type filter."}
              </p>

              {artifacts.length ===
                0 && (
                <Button
                  className="mt-4"
                  onClick={
                    openNewArtifact
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Artifact
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredArtifacts.map(
                (artifact) => {
                  const owner =
                    getOwnerName(
                      artifact,
                    )

                  const location =
                    getLocationName(
                      artifact,
                    )

                  const artifactAliases =
                    artifact.aliases ??
                    []

                  return (
                    <div
                      key={
                        artifact.id
                      }
                      className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              openEditArtifact(
                                artifact,
                              )
                            }
                            aria-label={`Edit ${artifact.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDelete(
                                artifact,
                              )
                            }
                            aria-label={`Delete ${artifact.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">
                            {
                              artifact.name
                            }
                          </h2>

                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {
                              artifact.type
                            }
                          </span>
                        </div>

                        {artifactAliases.length >
                          0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              Also known as
                            </p>

                            <div className="mt-1 flex flex-wrap gap-1">
                              {artifactAliases.map(
                                (
                                  alias,
                                  index,
                                ) => (
                                  <span
                                    key={`${alias}-${index}`}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {
                                      alias
                                    }
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {artifact.description ||
                            "No description."}
                        </p>
                      </div>

                      {(owner ||
                        location) && (
                        <div className="mt-4 space-y-2 border-t pt-4">
                          {owner && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Crown className="h-3.5 w-3.5" />

                              <span>
                                Owner:
                              </span>

                              <span className="font-medium text-foreground">
                                {
                                  owner
                                }
                              </span>
                            </div>
                          )}

                          {location && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />

                              <span>
                                Location:
                              </span>

                              <span className="font-medium text-foreground">
                                {
                                  location
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-auto pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between"
                          onClick={() =>
                            openEditArtifact(
                              artifact,
                            )
                          }
                        >
                          Edit artifact

                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
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
