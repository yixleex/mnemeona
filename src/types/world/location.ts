export type LocationType =
  | "Continent"
  | "Country"
  | "Region"
  | "City"
  | "Town"
  | "Village"
  | "District"
  | "Building"
  | "Landmark"
  | "Dungeon"
  | "Battlefield"
  | "Natural Feature"
  | "Other"

export interface Location {
  id: string

  name: string
  type: LocationType
  description: string

  /**
   * Optional hierarchy.
   *
   * Example:
   * City → Region → Country → Continent
   */
  parentLocationId?: string

  region?: string
  climate?: string
  population?: string
  government?: string

  /**
   * Story-specific context.
   */
  significance?: string
  history?: string
  secrets?: string

  createdAt: string
  updatedAt: string
}
