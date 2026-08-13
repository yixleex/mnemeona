import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Character } from "@/types/character"
import { useProject } from "@/context/ProjectContext"

interface CharacterRelationshipsProps {
  onBack: () => void
}

export function CharacterRelationships({
  onBack,
}: CharacterRelationshipsProps) {
  const {
    project,
    addCharacterRelationship,
    updateCharacterRelationship,
    deleteCharacterRelationship,
  } = useProject()

  const characters = project.characters

  const [selectedCharacterId, setSelectedCharacterId] =
    useState<string | null>(
      characters[0]?.id ?? null,
    )

  const [isCreating, setIsCreating] =
    useState(false)

  const [editingRelationshipId, setEditingRelationshipId] =
    useState<string | null>(null)

  /*
   * Keep the selected character valid when:
   *
   * - a character is deleted
   * - another project is loaded
   * - the character list changes
   */
  useEffect(() => {
    if (
      selectedCharacterId &&
      characters.some(
        (character) =>
          character.id === selectedCharacterId,
      )
    ) {
      return
    }

    setSelectedCharacterId(
      characters[0]?.id ?? null,
    )

    setIsCreating(false)
    setEditingRelationshipId(null)
  }, [characters, selectedCharacterId])

  const selectedCharacter =
    characters.find(
      (character) =>
        character.id === selectedCharacterId,
    ) ?? null

  /*
   * Relationships belong to their source character.
   *
   * Each relationship also explicitly stores
   * both character IDs:
   *
   * characterId       = source/original character
   * targetCharacterId = target character
   *
   * Example:
   *
   * Alice -> Bob
   *
   * {
   *   characterId: "alice-id",
   *   targetCharacterId: "bob-id",
   *   type: "rival",
   *   description: "..."
   * }
   */
  const relationships = useMemo(() => {
    if (!selectedCharacter) {
      return []
    }

    return selectedCharacter.relationships
  }, [selectedCharacter])

  function handleCreate() {
    if (!selectedCharacter) {
      return
    }

    if (characters.length < 2) {
      return
    }

    setEditingRelationshipId(null)
    setIsCreating(true)
  }

  function handleCancelCreate() {
    setIsCreating(false)
  }

  function handleDelete(
    characterId: string,
    relationshipId: string,
  ) {
    deleteCharacterRelationship(
      characterId,
      relationshipId,
    )

    if (
      editingRelationshipId ===
      relationshipId
    ) {
      setEditingRelationshipId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onBack}
          title="Back to Character Database"
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div className="ml-3">
          <div className="text-sm font-medium">
            Character Database
          </div>
        </div>

        <div className="ml-4 border-l pl-4">
          <h1 className="text-sm font-medium">
            Relationships
          </h1>

          <p className="text-[11px] text-muted-foreground">
            Define how your characters relate
          </p>
        </div>

        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={
              !selectedCharacter ||
              characters.length < 2
            }
          >
            <Plus className="mr-1.5 size-4" />
            New relationship
          </Button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Character selector */}
        <aside className="flex w-64 shrink-0 flex-col border-r">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              CHARACTER
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {characters.map((character) => {
              const active =
                character.id ===
                selectedCharacterId

              const relationshipCount =
                character.relationships.length

              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => {
                    setSelectedCharacterId(
                      character.id,
                    )

                    setIsCreating(false)
                    setEditingRelationshipId(
                      null,
                    )
                  }}
                  className={[
                    "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    active
                      ? "bg-accent"
                      : "hover:bg-muted/60",
                  ].join(" ")}
                >
                  <CharacterAvatar
                    character={character}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {character.name ||
                        "Unnamed character"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {relationshipCount}{" "}
                      {relationshipCount === 1
                        ? "relationship"
                        : "relationships"}
                    </div>
                  </div>
                </button>
              )
            })}

            {characters.length === 0 && (
              <div className="px-3 py-8 text-center">
                <Users className="mx-auto mb-2 size-5 text-muted-foreground" />

                <p className="text-sm font-medium">
                  No characters yet
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Create characters before
                  adding relationships.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Relationships */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {selectedCharacter ? (
            <div className="mx-auto max-w-3xl px-8 py-8">
              {/* Character heading */}
              <div className="mb-8 flex items-center gap-3">
                <CharacterAvatar
                  character={selectedCharacter}
                  size="large"
                />

                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedCharacter.name ||
                      "Unnamed character"}
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Relationships from this
                    character's perspective
                  </p>
                </div>
              </div>

              {/* Create relationship */}
              {isCreating && (
                <RelationshipEditor
                  characters={characters}
                  sourceCharacter={
                    selectedCharacter
                  }
                  onSave={(
                    targetCharacterId,
                    type,
                    description,
                  ) => {
                    addCharacterRelationship(
                      selectedCharacter.id,
                      targetCharacterId,
                      type,
                      description,
                    )

                    setIsCreating(false)
                  }}
                  onCancel={
                    handleCancelCreate
                  }
                />
              )}

              {/* Relationship list */}
              <div className="space-y-3">
                {relationships.length === 0 &&
                  !isCreating && (
                    <div className="rounded-xl border border-dashed p-10 text-center">
                      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-muted">
                        <ArrowRight className="size-5 text-muted-foreground" />
                      </div>

                      <h3 className="text-sm font-medium">
                        No relationships yet
                      </h3>

                      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                        Define how{" "}
                        {selectedCharacter.name ||
                          "this character"}{" "}
                        feels about, knows, or
                        relates to other
                        characters.
                      </p>

                      {characters.length >=
                        2 && (
                        <Button
                          size="sm"
                          className="mt-4"
                          onClick={
                            handleCreate
                          }
                        >
                          <Plus className="mr-2 size-4" />
                          Add relationship
                        </Button>
                      )}
                    </div>
                  )}

                {relationships.map(
                  (relationship) => {
                    /*
                     * The relationship explicitly
                     * stores both IDs.
                     *
                     * relationship.characterId
                     *     = source character
                     *
                     * relationship.targetCharacterId
                     *     = target character
                     */
                    const targetCharacter =
                      characters.find(
                        (character) =>
                          character.id ===
                          relationship.targetCharacterId,
                      )

                    /*
                     * A relationship can become
                     * orphaned if its target
                     * character is deleted.
                     *
                     * Do not crash the UI.
                     */
                    if (!targetCharacter) {
                      return (
                        <div
                          key={
                            relationship.id
                          }
                          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                        >
                          <p className="text-sm font-medium">
                            Missing character
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            This relationship
                            points to a character
                            that no longer exists.
                          </p>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-destructive hover:text-destructive"
                            onClick={() =>
                              handleDelete(
                                selectedCharacter.id,
                                relationship.id,
                              )
                            }
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            Remove
                          </Button>
                        </div>
                      )
                    }

                    const editing =
                      editingRelationshipId ===
                      relationship.id

                    if (editing) {
                      return (
                        <RelationshipEditor
                          key={
                            relationship.id
                          }
                          characters={
                            characters
                          }
                          sourceCharacter={
                            selectedCharacter
                          }
                          initialTargetId={
                            relationship.targetCharacterId
                          }
                          initialType={
                            relationship.type
                          }
                          initialDescription={
                            relationship.description
                          }
                          onSave={(
                            targetCharacterId,
                            type,
                            description,
                          ) => {
                            updateCharacterRelationship(
                              selectedCharacter.id,
                              relationship.id,
                              {
                                targetCharacterId,
                                type,
                                description,
                              },
                            )

                            setEditingRelationshipId(
                              null,
                            )
                          }}
                          onCancel={() =>
                            setEditingRelationshipId(
                              null,
                            )
                          }
                        />
                      )
                    }

                    return (
                      <div
                        key={
                          relationship.id
                        }
                        className="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/20"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {/* Source */}
                            <CharacterAvatar
                              character={
                                selectedCharacter
                              }
                            />

                            {/* Direction */}
                            <div className="flex min-w-0 flex-col items-center">
                              <ArrowRight className="size-4 text-muted-foreground" />

                              <span className="mt-1 text-[10px] text-muted-foreground">
                                relates to
                              </span>
                            </div>

                            {/* Target */}
                            <CharacterAvatar
                              character={
                                targetCharacter
                              }
                            />

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {
                                    targetCharacter.name
                                  }
                                </span>

                                {relationship.type && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {
                                      relationship.type
                                    }
                                  </span>
                                )}
                              </div>

                              {relationship.description && (
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                  {
                                    relationship.description
                                  }
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                setEditingRelationshipId(
                                  relationship.id,
                                )
                              }
                              title="Edit relationship"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() =>
                                handleDelete(
                                  selectedCharacter.id,
                                  relationship.id,
                                )
                              }
                              title="Delete relationship"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto mb-3 size-6 text-muted-foreground" />

                <p className="text-sm font-medium">
                  Select a character
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a character to view
                  their relationships.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function CharacterAvatar({
  character,
  size = "small",
}: {
  character: Character
  size?: "small" | "large"
}) {
  const initial =
    character.name
      .trim()
      .charAt(0)
      .toUpperCase() || "?"

  if (size === "large") {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-semibold text-muted-foreground">
        {initial}
      </div>
    )
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
      {initial}
    </div>
  )
}

interface RelationshipEditorProps {
  characters: Character[]
  sourceCharacter: Character

  initialTargetId?: string
  initialType?: string
  initialDescription?: string

  onSave: (
    targetCharacterId: string,
    type: string,
    description: string,
  ) => void

  onCancel: () => void
}

function RelationshipEditor({
  characters,
  sourceCharacter,
  initialTargetId,
  initialType = "",
  initialDescription = "",
  onSave,
  onCancel,
}: RelationshipEditorProps) {
  const availableCharacters =
    characters.filter(
      (character) =>
        character.id !==
        sourceCharacter.id,
    )

  const [
    targetCharacterId,
    setTargetCharacterId,
  ] = useState(
    initialTargetId ??
      availableCharacters[0]?.id ??
      "",
  )

  const [type, setType] =
    useState(initialType)

  const [description, setDescription] =
    useState(initialDescription)

  /*
   * The source character is always
   * supplied by the selected character.
   *
   * The target is selected here.
   *
   * This means the final relationship
   * contains both:
   *
   * characterId
   * targetCharacterId
   */
  const canSave =
    targetCharacterId !== "" &&
    type.trim() !== ""

  function handleSubmit() {
    if (!canSave) {
      return
    }

    onSave(
      targetCharacterId,
      type.trim(),
      description.trim(),
    )
  }

  return (
    <div className="mb-6 rounded-xl border bg-muted/10 p-5">
      {/* Editor header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {initialTargetId
              ? "Edit relationship"
              : "New relationship"}
          </h3>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Define how{" "}
            {sourceCharacter.name ||
              "this character"}{" "}
            relates to another character.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onCancel}
          title="Cancel"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Characters */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Source */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            From
          </label>

          <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
            <CharacterAvatar
              character={sourceCharacter}
            />

            <span className="truncate">
              {sourceCharacter.name ||
                "Unnamed character"}
            </span>
          </div>
        </div>

        {/* Target */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            To
          </label>

          <select
            value={targetCharacterId}
            onChange={(event) =>
              setTargetCharacterId(
                event.target.value,
              )
            }
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {availableCharacters.map(
              (character) => (
                <option
                  key={character.id}
                  value={character.id}
                >
                  {character.name ||
                    "Unnamed character"}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {/* Type */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Relationship
        </label>

        <input
          value={type}
          onChange={(event) =>
            setType(event.target.value)
          }
          placeholder="Sibling, rival, mentor, lover..."
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />

        <p className="mt-1 text-[11px] text-muted-foreground">
          Use a short label such as
          "sibling", "rival", "mentor", or
          "friend".
        </p>
      </div>

      {/* Description */}
      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Description
        </label>

        <textarea
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value,
            )
          }
          placeholder="Describe how these characters relate to each other..."
          className="min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          disabled={!canSave}
          onClick={handleSubmit}
        >
          {initialTargetId
            ? "Save changes"
            : "Add relationship"}
        </Button>
      </div>
    </div>
  )
}
