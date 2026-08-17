export type MnemeonaImageType =
  | "character"
  | "location"
  | "landmark"
  | "scene"
  | "document"
  | "custom"

export interface MnemeonaImage {
  id: string

  projectId: string

  name: string

  type: MnemeonaImageType

  /**
   * ID of the entity this image belongs to.
   *
   * Character:
   *   character.id
   *
   * Location:
   *   location.id
   *
   * Landmark:
   *   landmark.id
   */
  entityId?: string

  mimeType: string

  blob: Blob

  prompt: string

  width: number

  height: number

  createdAt: string

  updatedAt: string
}
