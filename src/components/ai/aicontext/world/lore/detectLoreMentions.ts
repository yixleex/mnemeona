import type { Lore } from "@/types/world/lore"
import type { LoreMention } from "@/types/aicontext"

export function detectLoreMentions(
  text: string,
  loreEntries: Lore[],
): LoreMention[] {
  if (!text.trim() || loreEntries.length === 0) {
    return []
  }

  const normalizedText = text.toLocaleLowerCase()

  const mentions: LoreMention[] = []

  for (const lore of loreEntries) {
    const namesToCheck = [
      {
        value: lore.name,
        source: "name" as const,
      },
      ...(lore.aliases ?? []).map(
        (alias) => ({
          value: alias,
          source: "alias" as const,
        }),
      ),
    ]

    /*
     * Check aliases and the canonical name independently.
     *
     * Longer names are checked first so that:
     *
     *   "The Last Prophecy"
     *
     * is preferred over:
     *
     *   "Prophecy"
     *
     * when both exist.
     *
     * Multi-word names are kept intact. We never split
     * aliases on spaces.
     */
    namesToCheck.sort(
      (a, b) =>
        b.value.length -
        a.value.length,
    )

    let bestMatch:
      | {
          value: string
          source: "name" | "alias"
        }
      | undefined

    for (const candidate of namesToCheck) {
      const value =
        candidate.value.trim()

      if (!value) {
        continue
      }

      /*
       * Escape the candidate before putting it into
       * a regular expression.
       */
      const escaped =
        value.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        )

      /*
       * Use Unicode-aware word boundaries where possible.
       *
       * The lookbehind/lookahead checks prevent matching
       * a name inside a larger word while still allowing
       * punctuation around the lore name.
       */
      const pattern =
        new RegExp(
          `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
          "iu",
        )

      if (
        pattern.test(
          text,
        )
      ) {
        bestMatch =
          {
            value,
            source:
              candidate.source,
          }

        break
      }
    }

    if (!bestMatch) {
      continue
    }

    /*
     * Canonical names receive a slightly higher confidence
     * than aliases.
     */
    const confidence =
      bestMatch.source === "name"
        ? 1
        : 0.95

    mentions.push({
      loreId: lore.id,
      matchedText:
        bestMatch.value,
      confidence,
      source:
        bestMatch.source,
    })
  }

  /*
   * Sort strongest matches first.
   */
  mentions.sort(
    (a, b) =>
      b.confidence -
      a.confidence,
  )

  return mentions
}
