import { useEffect, useMemo, useState } from "react"

import {
  Plus,
  Search,
  Users,
  GitBranch,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Character } from "@/types/character"
import { useProject } from "@/context/ProjectContext"

interface CharacterDatabaseProps {
  onOpenRelationships: () => void
}

export function CharacterDatabase({
  onOpenRelationships,
}: CharacterDatabaseProps) {
  const {
    project,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    updateCharacterContext,
  } = useProject()

  const characters = project.characters

  const [selectedId, setSelectedId] =
    useState<string | null>(
      characters[0]?.id ?? null,
    )

  const [search, setSearch] = useState("")

  /*
   * Keep the selected character valid when the
   * project changes, for example after deleting
   * the currently selected character or loading
   * another project.
   */
  useEffect(() => {
    if (
      selectedId &&
      characters.some(
        (character) =>
          character.id === selectedId,
      )
    ) {
      return
    }

    setSelectedId(
      characters[0]?.id ?? null,
    )
  }, [characters, selectedId])

  const selectedCharacter =
    characters.find(
      (character) =>
        character.id === selectedId,
    ) ?? null

  const filteredCharacters = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim()

    if (!query) {
      return characters
    }

    return characters.filter(
      (character) => {
        return (
          character.name
            .toLowerCase()
            .includes(query) ||
          character.role
            .toLowerCase()
            .includes(query) ||
          character.aliases.some(
            (alias) =>
              alias
                .toLowerCase()
                .includes(query),
          )
        )
      },
    )
  }, [characters, search])

  function handleCreateCharacter() {
    const id = addCharacter()

    setSelectedId(id)
  }

  function handleDeleteCharacter() {
    if (!selectedCharacter) {
      return
    }

    const deletedId =
      selectedCharacter.id

    const nextCharacter =
      characters.find(
        (character) =>
          character.id !== deletedId,
      )

    deleteCharacter(deletedId)

    setSelectedId(
      nextCharacter?.id ?? null,
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b px-6">
        <div>
          <h1 className="text-sm font-medium">
            Characters
          </h1>

          <p className="text-[11px] text-muted-foreground">
            {characters.length}{" "}
            {characters.length === 1
              ? "character"
              : "characters"}{" "}
            in your story
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={
              onOpenRelationships
            }
          >
            <GitBranch className="mr-1.5 size-4" />
            Relationships
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={
              handleCreateCharacter
            }
          >
            <Plus className="mr-1.5 size-4" />
            New character
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Character list */}
        <aside className="flex w-64 shrink-0 flex-col border-r">
          {/* Search */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search characters..."
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredCharacters.map(
              (character) => {
                const active =
                  character.id ===
                  selectedId

                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(
                        character.id,
                      )
                    }
                    className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-accent"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {character.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {character.name ||
                          "Unnamed character"}
                      </div>

                      <div className="truncate text-xs text-muted-foreground">
                        {character.role ||
                          character.aliases[0] ||
                          "No role assigned"}
                      </div>
                    </div>

                    {character.contextEnabled && (
                      <div
                        className="ml-auto size-1.5 shrink-0 rounded-full bg-foreground/60"
                        title="Included in AI context"
                      />
                    )}
                  </button>
                )
              },
            )}

            {filteredCharacters.length ===
              0 && (
              <div className="px-3 py-8 text-center">
                <Users className="mx-auto mb-2 size-5 text-muted-foreground" />

                <p className="text-sm font-medium">
                  {characters.length === 0
                    ? "No characters yet"
                    : "No characters found"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {characters.length ===
                  0
                    ? "Create your first character to begin."
                    : "Try a different search."}
                </p>

                {characters.length ===
                  0 && (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={
                      handleCreateCharacter
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    Create character
                  </Button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Character editor */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {selectedCharacter ? (
            <CharacterEditor
              character={
                selectedCharacter
              }
              onUpdate={(updates) =>
                updateCharacter(
                  selectedCharacter.id,
                  updates,
                )
              }
              onDelete={
                handleDeleteCharacter
              }
              onContextToggle={(
                enabled,
              ) =>
                updateCharacterContext(
                  selectedCharacter.id,
                  enabled,
                )
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent">
                  <Users className="size-5" />
                </div>

                <h2 className="text-sm font-medium">
                  No characters yet
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first character
                  to begin.
                </p>

                <Button
                  className="mt-4"
                  onClick={
                    handleCreateCharacter
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Create character
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

interface CharacterEditorProps {
  character: Character

  onUpdate: (
    updates: Partial<Character>,
  ) => void

  onDelete: () => void

  onContextToggle: (
    enabled: boolean,
  ) => void
}

function CharacterEditor({
  character,
  onUpdate,
  onDelete,
  onContextToggle,
}: CharacterEditorProps) {
  function addAlias(value: string) {
    const alias = value.trim()

    if (!alias) {
      return
    }

    const alreadyExists =
      character.aliases.some(
        (existing) =>
          existing.toLowerCase() ===
          alias.toLowerCase(),
      )

    if (alreadyExists) {
      return
    }

    onUpdate({
      aliases: [
        ...character.aliases,
        alias,
      ],
    })
  }

  function removeAlias(
    aliasToRemove: string,
  ) {
    onUpdate({
      aliases: character.aliases.filter(
        (alias) =>
          alias !== aliasToRemove,
      ),
    })
  }

  function updateAlias(
    index: number,
    value: string,
  ) {
    const aliases = [
      ...character.aliases,
    ]

    aliases[index] = value

    onUpdate({
      aliases,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      {/* Character heading */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-semibold">
          {character.name
            .charAt(0)
            .toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={character.name}
            onChange={(event) =>
              onUpdate({
                name: event.target.value,
              })
            }
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
            placeholder="Character name"
          />

          <input
            value={character.role}
            onChange={(event) =>
              onUpdate({
                role: event.target.value,
              })
            }
            className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none"
            placeholder="Role — protagonist, antagonist, mentor..."
          />
        </div>
      </div>

      {/* Aliases */}
      <CharacterSection
        title="Aliases"
        description="Other names, nicknames, titles, or names this character may be called."
      >
        <AliasEditor
          aliases={character.aliases}
          onAdd={addAlias}
          onRemove={removeAlias}
          onUpdate={updateAlias}
        />

        <p className="text-[11px] leading-5 text-muted-foreground">
          Mnemeona will use these aliases when
          detecting this character in your
          manuscript.
        </p>
      </CharacterSection>

      {/* AI context */}
      <section className="mt-8 rounded-xl border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
            <Sparkles className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  AI story context
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mnemeona can use this
                  character when generating
                  or discussing your story.
                </p>
              </div>

              <button
                type="button"
                aria-label={
                  character.contextEnabled
                    ? "Disable AI context"
                    : "Enable AI context"
                }
                aria-pressed={
                  character.contextEnabled
                }
                onClick={() =>
                  onContextToggle(
                    !character.contextEnabled,
                  )
                }
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  character.contextEnabled
                    ? "bg-foreground"
                    : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition ${
                    character.contextEnabled
                      ? "left-6"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Overview */}
      <CharacterSection
        title="Overview"
        description="The essential information Mnemeona should know."
      >
        <CharacterTextarea
          value={character.summary}
          onChange={(value) =>
            onUpdate({
              summary: value,
            })
          }
          placeholder="Who is this character?"
        />
      </CharacterSection>

      {/* Personality */}
      <CharacterSection
        title="Personality"
        description="How they think, behave, speak, and react."
      >
        <CharacterTextarea
          value={character.personality}
          onChange={(value) =>
            onUpdate({
              personality: value,
            })
          }
          placeholder="Describe their personality..."
        />
      </CharacterSection>

      {/* Appearance */}
      <CharacterSection
        title="Appearance"
        description="Physical traits and visual details."
      >
        <CharacterTextarea
          value={character.appearance}
          onChange={(value) =>
            onUpdate({
              appearance: value,
            })
          }
          placeholder="Describe their appearance..."
        />
      </CharacterSection>

      {/* Background */}
      <CharacterSection
        title="Background"
        description="History, upbringing, and important past events."
      >
        <CharacterTextarea
          value={character.background}
          onChange={(value) =>
            onUpdate({
              background: value,
            })
          }
          placeholder="Where did they come from?"
        />
      </CharacterSection>

      {/* Goals & motivation */}
      <CharacterSection
        title="Goals & motivation"
        description="What drives them forward?"
      >
        <CharacterTextarea
          value={character.goals}
          onChange={(value) =>
            onUpdate({
              goals: value,
            })
          }
          placeholder="What does this character want?"
        />

        <CharacterTextarea
          value={character.motivations}
          onChange={(value) =>
            onUpdate({
              motivations: value,
            })
          }
          placeholder="Why do they want it?"
        />

        <CharacterTextarea
          value={character.fears}
          onChange={(value) =>
            onUpdate({
              fears: value,
            })
          }
          placeholder="What are they afraid of?"
        />
      </CharacterSection>

      {/* Notes */}
      <CharacterSection
        title="Writer's notes"
        description="Anything else you want Mnemeona to remember."
      >
        <CharacterTextarea
          value={character.notes}
          onChange={(value) =>
            onUpdate({
              notes: value,
            })
          }
          placeholder="Private notes about this character..."
        />
      </CharacterSection>

      {/* Danger zone */}
      <section className="mt-12 border-t pt-6">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 size-4" />
          Delete character
        </Button>
      </section>
    </div>
  )
}

function AliasEditor({
  aliases,
  onAdd,
  onRemove,
  onUpdate,
}: {
  aliases: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  onUpdate: (
    index: number,
    value: string,
  ) => void
}) {
  const [newAlias, setNewAlias] =
    useState("")

  function handleAdd() {
    const value =
      newAlias.trim()

    if (!value) {
      return
    }

    onAdd(value)
    setNewAlias("")
  }

  function handleKeyDown(
    event: React.KeyboardEvent,
  ) {
    if (event.key === "Enter") {
      event.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-2">
      {aliases.map(
        (alias, index) => (
          <div
            key={`${alias}-${index}`}
            className="flex items-center gap-2"
          >
            <input
              value={alias}
              onChange={(event) =>
                onUpdate(
                  index,
                  event.target.value,
                )
              }
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
              placeholder="Alias"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() =>
                onRemove(alias)
              }
              aria-label={`Remove alias ${alias}`}
            >
              <X className="size-4" />
            </Button>
          </div>
        ),
      )}

      <div className="flex items-center gap-2">
        <input
          value={newAlias}
          onChange={(event) =>
            setNewAlias(
              event.target.value,
            )
          }
          onKeyDown={handleKeyDown}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
          placeholder="Add an alias..."
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newAlias.trim()}
        >
          <Plus className="mr-1.5 size-4" />
          Add
        </Button>
      </div>
    </div>
  )
}

function CharacterSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <div className="mb-3">
        <h3 className="text-sm font-medium">
          {title}
        </h3>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  )
}

function CharacterTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <textarea
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      placeholder={placeholder}
      className="min-h-24 w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
    />
  )
}
