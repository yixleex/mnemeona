export interface CharacterRelationship {
  id: string
  characterId: string
  targetCharacterId: string
  type: string
  description: string
}

export interface Character {
  id: string
  name: string
  aliases: string[]
  role: string

  summary: string
  personality: string
  appearance: string
  background: string
  age: string

  goals: string
  fears: string
  motivations: string

  relationships: CharacterRelationship[]
  notes: string

  contextEnabled: boolean

  createdAt: string
  updatedAt: string
}
