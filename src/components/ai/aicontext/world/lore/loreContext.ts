import type { Lore } from "@/types/world/lore"

/**
 * Format a lore entry for inclusion in AI context.
 *
 * The canonical name and all aliases are included so the AI
 * understands that different names refer to the same piece of lore.
 */
export function formatLoreForContext(
  lore: Lore,
): string {
  const lines: string[] = []

  lines.push(`### ${lore.name}`)

  if (lore.aliases.length > 0) {
    lines.push(
      `Also known as: ${lore.aliases.join(", ")}`,
    )
  }

  lines.push(`Type: ${lore.type}`)

  if (lore.description) {
    lines.push(
      `Description: ${lore.description}`,
    )
  }

  if (lore.origins) {
    lines.push(
      `Origins: ${lore.origins}`,
    )
  }

  if (lore.beliefs) {
    lines.push(
      `Beliefs: ${lore.beliefs}`,
    )
  }

  if (lore.significance) {
    lines.push(
      `Significance: ${lore.significance}`,
    )
  }

  if (lore.history) {
    lines.push(
      `History: ${lore.history}`,
    )
  }

  if (lore.truth) {
    lines.push(
      `Truth: ${lore.truth}`,
    )
  }

  if (lore.secrets) {
    lines.push(
      `Secrets: ${lore.secrets}`,
    )
  }

  return lines.join("\n")
}

/**
 * Format multiple lore entries for AI context.
 */
export function formatLoreCollectionForContext(
  loreEntries: Lore[],
): string {
  if (loreEntries.length === 0) {
    return ""
  }

  return loreEntries
    .map(formatLoreForContext)
    .join("\n\n")
}
