import { useMemo, useState } from "react"

import {
  ChevronDown,
  ChevronLeft,
  Edit,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProject } from "@/context/ProjectContext"

import type {
  Lore,
  LoreType,
} from "@/types/world/lore"

interface LoreDatabaseProps {
  onClose?: () => void
}

const LORE_TYPES: LoreType[] = [
  "Myth",
  "Legend",
  "Religion",
  "Tradition",
  "Custom",
  "Prophecy",
  "Folklore",
  "Historical Record",
  "Philosophy",
  "Theory",
  "Other",
]

interface LoreEditorProps {
  lore: Lore | null
  onSave: (lore: Lore) => void
  onCancel: () => void
}

function LoreEditor({
  lore,
  onSave,
  onCancel,
}: LoreEditorProps) {
  const [name, setName] = useState(
    lore?.name ?? "",
  )

  const [aliases, setAliases] =
    useState<string[]>(
      lore?.aliases ?? [],
    )

  const [type, setType] =
    useState<LoreType>(
      lore?.type ?? "Other",
    )

  const [description, setDescription] =
    useState(
      lore?.description ?? "",
    )

  const [origins, setOrigins] =
    useState(
      lore?.origins ?? "",
    )

  const [beliefs, setBeliefs] =
    useState(
      lore?.beliefs ?? "",
    )

  const [significance, setSignificance] =
    useState(
      lore?.significance ?? "",
    )

  const [history, setHistory] =
    useState(
      lore?.history ?? "",
    )

  const [truth, setTruth] =
    useState(
      lore?.truth ?? "",
    )

  const [secrets, setSecrets] =
    useState(
      lore?.secrets ?? "",
    )

  /*
   * Keep aliases as individual strings while editing.
   *
   * IMPORTANT:
   * We do NOT split on spaces.
   *
   * For example:
   *
   *   The Last Prophecy
   *
   * remains one alias.
   *
   * Multiple aliases are separated with commas:
   *
   *   The Last Prophecy, Final Prophecy, King's Prophecy
   */
  const aliasesText =
    aliases.join(", ")

  const handleAliasesChange = (
    value: string,
  ) => {
    const parsedAliases =
      value
        .split(",")
        .map((alias) =>
          alias.trim(),
        )
        .filter(Boolean)

    setAliases(
      parsedAliases,
    )
  }

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
     *
     * - trim surrounding whitespace
     * - remove empty aliases
     * - remove duplicates
     * - compare duplicates case-insensitively
     * - don't allow the canonical name as an alias
     * - preserve spaces inside aliases
     */
    const cleanedAliases: string[] = []

    const seenAliases =
      new Set<string>()

    const normalizedName =
      trimmedName.toLocaleLowerCase()

    for (const alias of aliases) {
      const trimmedAlias =
        alias.trim()

      if (!trimmedAlias) {
        continue
      }

      const normalizedAlias =
        trimmedAlias.toLocaleLowerCase()

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
        lore?.id ??
        `lore-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`,

      name: trimmedName,

      aliases:
        cleanedAliases,

      type,

      description:
        description.trim(),

      origins:
        origins.trim() ||
        undefined,

      beliefs:
        beliefs.trim() ||
        undefined,

      significance:
        significance.trim() ||
        undefined,

      history:
        history.trim() ||
        undefined,

      truth:
        truth.trim() ||
        undefined,

      secrets:
        secrets.trim() ||
        undefined,

      createdAt:
        lore?.createdAt ??
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
            placeholder="The Prophecy of the Last King"
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
                  event.target.value as LoreType,
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
            >
              {LORE_TYPES.map(
                (loreType) => (
                  <option
                    key={loreType}
                    value={loreType}
                  >
                    {loreType}
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
          placeholder="The Last Prophecy, Final Prophecy, King's Prophecy"
        />

        <p className="text-xs text-muted-foreground">
          Alternative names or phrases this lore
          may be called in your story. Separate
          multiple aliases with commas. Spaces inside
          an alias are preserved.
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
          placeholder="What is this lore and what do people believe about it?"
          className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Origins
        </label>

        <textarea
          value={origins}
          onChange={(event) =>
            setOrigins(
              event.target.value,
            )
          }
          placeholder="Where did this belief, myth, tradition, or story originate?"
          className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Beliefs
        </label>

        <textarea
          value={beliefs}
          onChange={(event) =>
            setBeliefs(
              event.target.value,
            )
          }
          placeholder="What do people believe about this?"
          className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="Why does this lore matter to the world or story?"
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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
            placeholder="How has this lore developed or changed over time?"
            className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Truth
        </label>

        <textarea
          value={truth}
          onChange={(event) =>
            setTruth(
              event.target.value,
            )
          }
          placeholder="What is actually true? This can differ from what people believe."
          className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <p className="text-xs text-muted-foreground">
          Use this for the objective truth behind
          myths, prophecies, religions, legends, or
          other lore.
        </p>
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
          placeholder="Hidden truths, forbidden knowledge, contradictions, mysteries, etc."
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
          {lore
            ? "Save Changes"
            : "Create Lore"}
        </Button>
      </div>
    </form>
  )
}

export function LoreDatabase({
  onClose,
}: LoreDatabaseProps) {
  const {
    project,
    updateProject,
  } = useProject()

  const loreEntries =
    project.lore ?? []

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("")

  const [
    selectedType,
    setSelectedType,
  ] = useState<
    LoreType | "All"
  >("All")

  const [
    editingLore,
    setEditingLore,
  ] = useState<Lore | null>(
    null,
  )

  const [
    editorOpen,
    setEditorOpen,
  ] = useState(false)

  const filteredLore =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase()

      return loreEntries.filter(
        (lore) => {
          const matchesSearch =
            !query ||
            lore.name
              .toLowerCase()
              .includes(query) ||
            (lore.aliases ??
              []
            ).some((alias) =>
              alias
                .toLowerCase()
                .includes(query),
            ) ||
            lore.type
              .toLowerCase()
              .includes(query) ||
            lore.description
              .toLowerCase()
              .includes(query) ||
            lore.origins
              ?.toLowerCase()
              .includes(query) ||
            lore.beliefs
              ?.toLowerCase()
              .includes(query) ||
            lore.significance
              ?.toLowerCase()
              .includes(query) ||
            lore.history
              ?.toLowerCase()
              .includes(query) ||
            lore.truth
              ?.toLowerCase()
              .includes(query) ||
            lore.secrets
              ?.toLowerCase()
              .includes(query)

          const matchesType =
            selectedType === "All" ||
            lore.type ===
              selectedType

          return (
            matchesSearch &&
            matchesType
          )
        },
      )
    }, [
      loreEntries,
      searchQuery,
      selectedType,
    ])

  const openNewLore = () => {
    setEditingLore(null)
    setEditorOpen(true)
  }

  const openEditLore = (
    lore: Lore,
  ) => {
    setEditingLore(lore)
    setEditorOpen(true)
  }

  const handleSave = (
    lore: Lore,
  ) => {
    updateProject(
      (currentProject) => {
        const currentLore =
          currentProject.lore ??
          []

        const exists =
          currentLore.some(
            (item) =>
              item.id === lore.id,
          )

        return {
          ...currentProject,

          lore: exists
            ? currentLore.map(
                (item) =>
                  item.id ===
                  lore.id
                    ? lore
                    : item,
              )
            : [
                ...currentLore,
                lore,
              ],

          updatedAt:
            new Date().toISOString(),
        }
      },
    )

    setEditorOpen(false)
    setEditingLore(null)
  }

  const handleDelete = (
    lore: Lore,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${lore.name}"?\n\nThis cannot be undone.`,
      )

    if (!confirmed) {
      return
    }

    updateProject(
      (currentProject) => ({
        ...currentProject,

        lore: (
          currentProject.lore ??
          []
        ).filter(
          (item) =>
            item.id !==
            lore.id,
        ),

        updatedAt:
          new Date().toISOString(),
      }),
    )
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
                setEditingLore(null)
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            <div className="h-5 w-px bg-border" />

            <div>
              <h1 className="text-lg font-semibold">
                {editingLore
                  ? "Edit World Lore"
                  : "New World Lore"}
              </h1>

              <p className="text-sm text-muted-foreground">
                Define a myth, belief, tradition,
                prophecy, or other piece of world lore.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl p-6">
            <LoreEditor
              lore={editingLore}
              onSave={handleSave}
              onCancel={() => {
                setEditorOpen(false)
                setEditingLore(null)
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
              <span className="text-lg">
                📜
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  World Lore
                </h1>

                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {loreEntries.length}{" "}
                  {loreEntries.length === 1
                    ? "entry"
                    : "entries"}
                </span>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Myths, legends, beliefs, traditions,
                prophecies, and other knowledge of your world.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={
                openNewLore
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New Lore
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
              placeholder="Search lore..."
              className="pl-9"
            />
          </div>

          <div className="relative sm:w-56">
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(
                  event.target.value as
                    | LoreType
                    | "All",
                )
              }
              className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm"
            >
              <option value="All">
                All types
              </option>

              {LORE_TYPES.map(
                (loreType) => (
                  <option
                    key={loreType}
                    value={loreType}
                  >
                    {loreType}
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
          {filteredLore.length ===
          0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed">
              <div className="mb-3 text-3xl">
                📜
              </div>

              <p className="text-sm font-medium">
                {loreEntries.length === 0
                  ? "No world lore yet"
                  : "No lore found"}
              </p>

              <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                {loreEntries.length === 0
                  ? "Create your first piece of world lore to start building the myths, beliefs, and history of your world."
                  : "Try changing your search or type filter."}
              </p>

              {loreEntries.length ===
                0 && (
                <Button
                  className="mt-4"
                  onClick={
                    openNewLore
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Lore
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLore.map(
                (lore) => (
                  <div
                    key={
                      lore.id
                    }
                    className="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <span className="text-lg">
                          📜
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            openEditLore(
                              lore,
                            )
                          }
                          aria-label={`Edit ${lore.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDelete(
                              lore,
                            )
                          }
                          aria-label={`Delete ${lore.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">
                          {
                            lore.name
                          }
                        </h2>

                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {
                            lore.type
                          }
                        </span>
                      </div>

                      {lore.aliases.length >
                        0 && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">
                            Also known as
                          </p>

                          <div className="mt-1 flex flex-wrap gap-1">
                            {lore.aliases.map(
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
                        {lore.description ||
                          "No description."}
                      </p>
                    </div>

                    {lore.significance && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs font-medium text-muted-foreground">
                          Significance
                        </p>

                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                          {
                            lore.significance
                          }
                        </p>
                      </div>
                    )}

                    <div className="mt-auto pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() =>
                          openEditLore(
                            lore,
                          )
                        }
                      >
                        Edit lore

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
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
