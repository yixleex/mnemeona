import { useEffect, useMemo, useState } from "react"

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
import type { MnemeonaImage } from "@/types/image"
import { useProject } from "@/context/ProjectContext"
import { listProjectImages } from "@/lib/imageDatabase"

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
    useState<string | null>(characters[0]?.id ?? null)

  const [isCreating, setIsCreating] = useState(false)
  const [editingRelationshipId, setEditingRelationshipId] =
    useState<string | null>(null)

  /*
   * Keep the selected character valid when:
   * - a character is deleted
   * - another project is loaded
   * - the character list changes
   */
  useEffect(() => {
    if (
      selectedCharacterId &&
      characters.some((character) => character.id === selectedCharacterId)
    ) {
      return
    }

    setSelectedCharacterId(characters[0]?.id ?? null)
    setIsCreating(false)
    setEditingRelationshipId(null)
  }, [characters, selectedCharacterId])

  /*
   * Load the same character images used by CharacterDatabase.
   *
   * Images live in IndexedDB rather than directly on the Character object.
   * We select the explicitly configured primary image when possible and
   * otherwise fall back to the newest character image.
   */
  const [characterImages, setCharacterImages] =
    useState<Map<string, MnemeonaImage>>(new Map())

  const [imageUrls, setImageUrls] =
    useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function loadCharacterImages() {
      try {
        const images = await listProjectImages(project.id)

        if (cancelled) {
          return
        }

        const nextImages = new Map<string, MnemeonaImage>()
        const nextUrls = new Map<string, string>()

        for (const character of characters) {
          const available = images
            .filter(
              (image) =>
                image.type === "character" &&
                image.entityId === character.id,
            )
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )

          if (!available.length) {
            continue
          }

          const primary =
            available.find(
              (image) => image.id === character.primaryImageId,
            ) ?? available[0]

          nextImages.set(character.id, primary)
          nextUrls.set(
            character.id,
            URL.createObjectURL(primary.blob),
          )
        }

        setCharacterImages((previous) => {
          previous.forEach((image, characterId) => {
            const next = nextImages.get(characterId)
            if (!next || next.id !== image.id) {
              const oldUrl = imageUrls.get(characterId)
              if (oldUrl) {
                URL.revokeObjectURL(oldUrl)
              }
            }
          })
          return nextImages
        })

        setImageUrls((previous) => {
          previous.forEach((url, characterId) => {
            const next = nextUrls.get(characterId)
            if (!next || next !== url) {
              URL.revokeObjectURL(url)
            }
          })
          return nextUrls
        })
      } catch {
        // Image loading must never prevent relationships from rendering.
      }
    }

    loadCharacterImages()

    return () => {
      cancelled = true
    }
  }, [project.id, characters])

  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageUrls])

  const selectedCharacter =
    characters.find(
      (character) => character.id === selectedCharacterId,
    ) ?? null

  const relationships = useMemo(() => {
    if (!selectedCharacter) {
      return []
    }

    return selectedCharacter.relationships
  }, [selectedCharacter])

  function handleCreate() {
    if (!selectedCharacter || characters.length < 2) {
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
    deleteCharacterRelationship(characterId, relationshipId)

    if (editingRelationshipId === relationshipId) {
      setEditingRelationshipId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
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
          <div className="text-sm font-medium">Character Database</div>
        </div>

        <div className="ml-4 border-l pl-4">
          <h1 className="text-sm font-medium">Relationships</h1>
          <p className="text-[11px] text-muted-foreground">
            Define how your characters relate
          </p>
        </div>

        <div className="ml-auto">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!selectedCharacter || characters.length < 2}
          >
            <Plus className="mr-1.5 size-4" />
            New relationship
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r">
          <div className="border-b px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              CHARACTER
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {characters.map((character) => {
              const active = character.id === selectedCharacterId
              const relationshipCount = character.relationships.length
              const imageUrl = imageUrls.get(character.id)

              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => {
                    setSelectedCharacterId(character.id)
                    setIsCreating(false)
                    setEditingRelationshipId(null)
                  }}
                  className={[
                    "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    active ? "bg-accent" : "hover:bg-muted/60",
                  ].join(" ")}
                >
                  <CharacterAvatar
                    character={character}
                    imageUrl={imageUrl}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {character.name || "Unnamed character"}
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
                <p className="text-sm font-medium">No characters yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create characters before adding relationships.
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {selectedCharacter ? (
            <div className="mx-auto max-w-3xl px-8 py-8">
              <div className="mb-8 flex items-center gap-3">
                <CharacterAvatar
                  character={selectedCharacter}
                  imageUrl={imageUrls.get(selectedCharacter.id)}
                  size="large"
                />

                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedCharacter.name || "Unnamed character"}
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Relationships from this character's perspective
                  </p>
                </div>
              </div>

              {isCreating && (
                <RelationshipEditor
                  characters={characters}
                  sourceCharacter={selectedCharacter}
                  imageUrls={imageUrls}
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
                  onCancel={handleCancelCreate}
                />
              )}

              <div className="space-y-3">
                {relationships.length === 0 && !isCreating && (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-muted">
                      <ArrowRight className="size-5 text-muted-foreground" />
                    </div>

                    <h3 className="text-sm font-medium">
                      No relationships yet
                    </h3>

                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                      Define how {selectedCharacter.name || "this character"}{" "}
                      feels about, knows, or relates to other characters.
                    </p>

                    {characters.length >= 2 && (
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={handleCreate}
                      >
                        <Plus className="mr-2 size-4" />
                        Add relationship
                      </Button>
                    )}
                  </div>
                )}

                {relationships.map((relationship) => {
                  const targetCharacter = characters.find(
                    (character) =>
                      character.id === relationship.targetCharacterId,
                  )

                  if (!targetCharacter) {
                    return (
                      <div
                        key={relationship.id}
                        className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                      >
                        <p className="text-sm font-medium">
                          Missing character
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          This relationship points to a character that no
                          longer exists.
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
                    editingRelationshipId === relationship.id

                  if (editing) {
                    return (
                      <RelationshipEditor
                        key={relationship.id}
                        characters={characters}
                        sourceCharacter={selectedCharacter}
                        imageUrls={imageUrls}
                        initialTargetId={relationship.targetCharacterId}
                        initialType={relationship.type}
                        initialDescription={relationship.description}
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

                          setEditingRelationshipId(null)
                        }}
                        onCancel={() =>
                          setEditingRelationshipId(null)
                        }
                      />
                    )
                  }

                  return (
                    <div
                      key={relationship.id}
                      className="group rounded-xl border bg-background p-4 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <CharacterAvatar
                            character={selectedCharacter}
                            imageUrl={imageUrls.get(selectedCharacter.id)}
                          />

                          <div className="flex min-w-0 flex-col items-center">
                            <ArrowRight className="size-4 text-muted-foreground" />
                            <span className="mt-1 text-[10px] text-muted-foreground">
                              relates to
                            </span>
                          </div>

                          <CharacterAvatar
                            character={targetCharacter}
                            imageUrl={imageUrls.get(targetCharacter.id)}
                          />

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">
                                {targetCharacter.name || "Unnamed character"}
                              </span>

                              {relationship.type && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {relationship.type}
                                </span>
                              )}
                            </div>

                            {relationship.description && (
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                {relationship.description}
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
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Select a character</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a character to view their relationships.
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
  imageUrl,
  size = "small",
}: {
  character: Character
  imageUrl?: string
  size?: "small" | "large"
}) {
  const initial =
    character.name.trim().charAt(0).toUpperCase() || "?"

  const sizeClass = size === "large" ? "size-12" : "size-9"
  const radiusClass = size === "large" ? "rounded-xl" : "rounded-full"
  const textClass =
    size === "large"
      ? "text-lg font-semibold text-muted-foreground"
      : "text-sm font-medium"

  return (
    <div
      className={`${sizeClass} ${radiusClass} shrink-0 overflow-hidden bg-muted`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <div
          className={`flex size-full items-center justify-center ${textClass}`}
        >
          {initial}
        </div>
      )}
    </div>
  )
}

interface RelationshipEditorProps {
  characters: Character[]
  sourceCharacter: Character
  imageUrls: Map<string, string>
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
  imageUrls,
  initialTargetId,
  initialType = "",
  initialDescription = "",
  onSave,
  onCancel,
}: RelationshipEditorProps) {
  const availableCharacters = characters.filter(
    (character) => character.id !== sourceCharacter.id,
  )

  const [targetCharacterId, setTargetCharacterId] = useState(
    initialTargetId ?? availableCharacters[0]?.id ?? "",
  )
  const [type, setType] = useState(initialType)
  const [description, setDescription] = useState(initialDescription)

  const canSave =
    targetCharacterId !== "" && type.trim() !== ""

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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {initialTargetId ? "Edit relationship" : "New relationship"}
          </h3>

          <p className="mt-0.5 text-xs text-muted-foreground">
            Define how {sourceCharacter.name || "this character"} relates to
            another character.
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

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            From
          </label>

          <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm">
            <CharacterAvatar
              character={sourceCharacter}
              imageUrl={imageUrls.get(sourceCharacter.id)}
            />
            <span className="truncate">
              {sourceCharacter.name || "Unnamed character"}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            To
          </label>

          <div className="flex h-10 items-center gap-2 rounded-lg border bg-background px-3">
            <CharacterAvatar
              character={
                availableCharacters.find(
                  (character) => character.id === targetCharacterId,
                ) ?? availableCharacters[0] ?? sourceCharacter
              }
              imageUrl={imageUrls.get(targetCharacterId)}
            />

            <select
              value={targetCharacterId}
              onChange={(event) =>
                setTargetCharacterId(event.target.value)
              }
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            >
              {availableCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name || "Unnamed character"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Relationship
        </label>

        <input
          value={type}
          onChange={(event) => setType(event.target.value)}
          placeholder="Sibling, rival, mentor, lover..."
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />

        <p className="mt-1 text-[11px] text-muted-foreground">
          Use a short label such as "sibling", "rival", "mentor", or "friend".
        </p>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Description
        </label>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder="Describe the relationship..."
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>

        <Button onClick={handleSubmit} disabled={!canSave}>
          {initialTargetId ? "Save changes" : "Create relationship"}
        </Button>
      </div>
    </div>
  )
}
