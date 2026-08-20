import type { JSONContent } from "@tiptap/core"

import type { MnemeonaProject } from "@/types/project"

type UnknownRecord = Record<string, unknown>

function escapeHtml(
  value: unknown,
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  )
}

function richTextToPlainText(
  content: unknown,
): string {
  if (
    typeof content === "string"
  ) {
    return content
  }

  if (
    !content ||
    typeof content !== "object"
  ) {
    return ""
  }

  if (
    Array.isArray(content)
  ) {
    return content
      .map((item) =>
        richTextToPlainText(item),
      )
      .filter(Boolean)
      .join("\n")
  }

  if (
    isRecord(content)
  ) {
    const parts: string[] = []

    if (
      typeof content.text ===
      "string"
    ) {
      parts.push(
        content.text,
      )
    }

    if (
      Array.isArray(
        content.content,
      )
    ) {
      parts.push(
        richTextToPlainText(
          content.content,
        ),
      )
    }

    return parts
      .filter(Boolean)
      .join("")
  }

  return ""
}

function renderRichText(
  content: unknown,
): string {
  const text =
    richTextToPlainText(
      content,
    )

  if (!text.trim()) {
    return ""
  }

  return text
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(
          paragraph,
        ).replaceAll(
          "\n",
          "<br>",
        )}</p>`,
    )
    .join("")
}

function formatValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return ""
  }

  if (
    typeof value === "string"
  ) {
    return escapeHtml(
      value,
    ).replaceAll(
      "\n",
      "<br>",
    )
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return escapeHtml(
      value,
    )
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        `<li>${formatValue(
          item,
        )}</li>`,
      )
      .join("")
      .replace(
        /^/,
        "<ul>",
      )
      .concat("</ul>")
  }

  if (
    isRecord(value)
  ) {
    return Object.entries(
      value,
    )
      .map(
        ([key, item]) =>
          `<div class="nested-field">
            <strong>${escapeHtml(
              humanizeKey(key),
            )}</strong>
            <div>${formatValue(
              item,
            )}</div>
          </div>`,
      )
      .join("")
  }

  return escapeHtml(
    String(value),
  )
}

function humanizeKey(
  key: string,
): string {
  return key
    .replace(
      /([a-z])([A-Z])/g,
      "$1 $2",
    )
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /^\w/,
      (letter) =>
        letter.toUpperCase(),
    )
}

function renderFields(
  item: UnknownRecord,
  excludedKeys: Set<string>,
): string {
  const preferredKeys = [
    "description",
    "type",
    "aliases",
    "synopsis",
    "pov",
    "location",
    "time",
    "powers",
    "abilities",
    "appearance",
    "history",
    "significance",
    "secrets",
    "personality",
    "background",
    "goals",
    "motivation",
    "relationships",
    "role",
    "leader",
    "headquarters",
    "members",
    "notes",
    "content",
  ]

  const keys = [
    ...preferredKeys.filter(
      (key) =>
        key in item &&
        !excludedKeys.has(key),
    ),
    ...Object.keys(item).filter(
      (key) =>
        !preferredKeys.includes(
          key,
        ) &&
        !excludedKeys.has(key),
    ),
  ]

  return keys
    .map((key) => {
      const value =
        item[key]

      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return ""
      }

      if (
        key === "content"
      ) {
        const richText =
          renderRichText(
            value,
          )

        if (!richText) {
          return ""
        }

        return `
          <div class="field">
            <div class="field-label">
              ${escapeHtml(
                humanizeKey(key),
              )}
            </div>
            <div class="rich-content">
              ${richText}
            </div>
          </div>
        `
      }

      return `
        <div class="field">
          <div class="field-label">
            ${escapeHtml(
              humanizeKey(key),
            )}
          </div>
          <div class="field-value">
            ${formatValue(
              value,
            )}
          </div>
        </div>
      `
    })
    .join("")
}

function renderCollection(
  title: string,
  items: unknown,
): string {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return ""
  }

  return `
    <section class="collection">
      <div class="section-title">
        ${escapeHtml(title)}
      </div>

      ${items
        .map((item) => {
          if (
            !isRecord(item)
          ) {
            return `
              <div class="card">
                ${formatValue(item)}
              </div>
            `
          }

          const name =
            typeof item.name ===
            "string"
              ? item.name
              : typeof item.title ===
                  "string"
                ? item.title
                : "Untitled"

          return `
            <article class="card">
              <h3>
                ${escapeHtml(
                  name,
                )}
              </h3>

              ${renderFields(
                item,
                new Set([
                  "id",
                  "name",
                  "title",
                  "createdAt",
                  "updatedAt",
                ]),
              )}
            </article>
          `
        })
        .join("")}
    </section>
  `
}

function renderScene(
  scene: UnknownRecord,
): string {
  const title =
    typeof scene.title ===
    "string"
      ? scene.title
      : "Untitled Scene"

  return `
    <article class="scene">
      <h4>
        ${escapeHtml(title)}
      </h4>

      ${
        typeof scene.synopsis ===
        "string" &&
        scene.synopsis.trim()
          ? `
            <div class="scene-synopsis">
              <strong>Synopsis</strong>
              <p>
                ${escapeHtml(
                  scene.synopsis,
                )}
              </p>
            </div>
          `
          : ""
      }

      <div class="scene-meta">
        ${
          scene.pov
            ? `<span><strong>POV:</strong> ${escapeHtml(scene.pov)}</span>`
            : ""
        }

        ${
          scene.location
            ? `<span><strong>Location:</strong> ${escapeHtml(scene.location)}</span>`
            : ""
        }

        ${
          scene.time
            ? `<span><strong>Time:</strong> ${escapeHtml(scene.time)}</span>`
            : ""
        }
      </div>

      ${
        scene.content
          ? `
            <div class="scene-content">
              ${renderRichText(
                scene.content as JSONContent,
              )}
            </div>
          `
          : ""
      }

      ${
        typeof scene.aiAdditionalContext ===
          "string" &&
        scene.aiAdditionalContext.trim()
          ? `
            <div class="additional-context">
              <strong>Additional Context</strong>
              <p>
                ${escapeHtml(
                  scene.aiAdditionalContext,
                ).replaceAll(
                  "\n",
                  "<br>",
                )}
              </p>
            </div>
          `
          : ""
      }
    </article>
  `
}

function renderManuscript(
  project: MnemeonaProject,
): string {
  const acts =
    project.manuscript
      ?.acts ?? []

  if (!acts.length) {
    return `
      <section class="collection">
        <div class="section-title">
          Manuscript
        </div>

        <p class="empty">
          No manuscript content yet.
        </p>
      </section>
    `
  }

  return `
    <section class="manuscript">
      <div class="section-title">
        Manuscript
      </div>

      ${acts
        .map((act, actIndex) => {
          const actRecord =
            act as unknown as UnknownRecord

          return `
            <section class="act">
              <div class="act-heading">
                <span class="eyebrow">
                  Act ${actIndex + 1}
                </span>

                <h2>
                  ${escapeHtml(
                    act.title,
                  )}
                </h2>

                ${
                  act.synopsis
                    ? `
                      <p class="synopsis">
                        ${escapeHtml(
                          act.synopsis,
                        )}
                      </p>
                    `
                    : ""
                }
              </div>

              ${(act.chapters ?? [])
                .map(
                  (
                    chapter,
                    chapterIndex,
                  ) => `
                    <section class="chapter">
                      <div class="chapter-heading">
                        <span class="eyebrow">
                          Chapter ${
                            chapterIndex +
                            1
                          }
                        </span>

                        <h3>
                          ${escapeHtml(
                            chapter.title,
                          )}
                        </h3>

                        ${
                          chapter.synopsis
                            ? `
                              <p class="synopsis">
                                ${escapeHtml(
                                  chapter.synopsis,
                                )}
                              </p>
                            `
                            : ""
                        }
                      </div>

                      ${(chapter.scenes ?? [])
                        .map(
                          (
                            scene,
                          ) =>
                            renderScene(
                              scene as unknown as UnknownRecord,
                            ),
                        )
                        .join("")}
                    </section>
                  `,
                )
                .join("")}
            </section>
          `
        })
        .join("")}
    </section>
  `
}

function buildProjectHtml(
  project: MnemeonaProject,
): string {
  const projectRecord =
    project as unknown as UnknownRecord

  const storySummary =
    typeof project.storySummary ===
    "string"
      ? project.storySummary
      : ""

  const manuscriptTitle =
    project.manuscript?.title ||
    "Manuscript"

  const exportedAt =
    new Date().toLocaleString()

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<title>
  ${escapeHtml(project.title)}
</title>

<style>
  @page {
    size: A4;
    margin: 20mm 18mm 22mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  body {
    font-family:
      Georgia,
      "Times New Roman",
      serif;

    color: #171717;
    background: white;
    font-size: 11pt;
    line-height: 1.65;
  }

  .document {
    max-width: 180mm;
    margin: 0 auto;
  }

  .cover {
    min-height: 240mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    page-break-after: always;
  }

  .cover h1 {
    font-size: 32pt;
    line-height: 1.15;
    margin: 0 0 18px;
  }

  .cover .subtitle {
    font-size: 15pt;
    color: #666;
    margin-bottom: 40px;
  }

  .cover .exported {
    font-size: 9pt;
    color: #888;
  }

  .section-title {
    font-size: 20pt;
    font-weight: 700;
    border-bottom: 2px solid #222;
    padding-bottom: 7px;
    margin: 0 0 24px;
  }

  .collection {
    page-break-before: always;
  }

  .card {
    border: 1px solid #d4d4d4;
    border-radius: 5px;
    padding: 15px;
    margin: 0 0 16px;
    page-break-inside: avoid;
  }

  .card h3 {
    margin: 0 0 12px;
    font-size: 15pt;
  }

  .field {
    margin: 0 0 11px;
    page-break-inside: avoid;
  }

  .field-label {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: #666;
    margin-bottom: 2px;
  }

  .field-value {
    white-space: normal;
  }

  .nested-field {
    margin: 4px 0;
  }

  .nested-field strong {
    margin-right: 5px;
  }

  ul {
    margin-top: 5px;
    margin-bottom: 5px;
  }

  .manuscript {
    page-break-before: always;
  }

  .act {
    page-break-before: always;
  }

  .act:first-of-type {
    page-break-before: auto;
  }

  .act-heading {
    margin-bottom: 28px;
  }

  .chapter {
    margin-bottom: 35px;
  }

  .chapter-heading {
    margin-bottom: 18px;
  }

  .eyebrow {
    display: block;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #777;
    font-weight: 700;
    margin-bottom: 3px;
  }

  .act h2 {
    font-size: 23pt;
    line-height: 1.2;
    margin: 0;
  }

  .chapter h3 {
    font-size: 18pt;
    line-height: 1.25;
    margin: 0;
  }

  .synopsis {
    color: #555;
    font-style: italic;
    margin: 7px 0 0;
  }

  .scene {
    margin: 30px 0 45px;
    page-break-inside: auto;
  }

  .scene h4 {
    font-size: 15pt;
    line-height: 1.3;
    margin: 0 0 10px;
  }

  .scene-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    color: #555;
    font-size: 9pt;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    padding: 7px 0;
    margin-bottom: 18px;
  }

  .scene-content {
    font-size: 12pt;
    line-height: 1.8;
  }

  .scene-content p {
    margin: 0 0 1em;
    text-indent: 1.5em;
  }

  .scene-content p:first-child {
    text-indent: 0;
  }

  .scene-synopsis,
  .additional-context {
    background: #f5f5f5;
    border-left: 3px solid #999;
    padding: 9px 12px;
    margin-bottom: 15px;
    font-size: 9.5pt;
  }

  .scene-synopsis p,
  .additional-context p {
    margin: 3px 0 0;
  }

  .story-summary {
    page-break-before: always;
    margin-bottom: 30px;
  }

  .story-summary-content {
    font-size: 11pt;
    line-height: 1.7;
  }

  .empty {
    color: #777;
    font-style: italic;
  }

  .page-break {
    page-break-before: always;
  }

  @media screen {
    body {
      background: #eee;
      padding: 30px;
    }

    .document {
      background: white;
      padding: 30px;
      max-width: 900px;
      margin: auto;
      box-shadow:
        0 2px 15px rgba(0, 0, 0, .12);
    }
  }

  @media print {
    .document {
      max-width: none;
    }
  }
</style>
</head>

<body>
<div class="document">

  <section class="cover">
    <h1>
      ${escapeHtml(project.title)}
    </h1>

    <div class="subtitle">
      ${escapeHtml(manuscriptTitle)}
    </div>

    <div class="exported">
      Exported ${escapeHtml(exportedAt)}
    </div>
  </section>

  ${
    storySummary.trim()
      ? `
        <section class="story-summary">
          <div class="section-title">
            Story Summary
          </div>

          <div class="story-summary-content">
            ${escapeHtml(
              storySummary,
            ).replaceAll(
              "\n",
              "<br>",
            )}
          </div>
        </section>
      `
      : ""
  }

  ${renderManuscript(project)}

  ${renderCollection(
    "Characters",
    projectRecord.characters,
  )}

  ${renderCollection(
    "Locations",
    projectRecord.locations,
  )}

  ${renderCollection(
    "World Events",
    projectRecord.events,
  )}

  ${renderCollection(
    "Factions",
    projectRecord.factions,
  )}

  ${renderCollection(
    "Artifacts",
    projectRecord.artifacts,
  )}

  ${renderCollection(
    "Notes",
    projectRecord.notes,
  )}

</div>

<script>
  window.addEventListener(
    "load",
    () => {
      setTimeout(
        () => {
          window.print()
        },
        250,
      )
    },
  )
</script>

</body>
</html>
  `
}

export async function exportProjectToPdf(
  project: MnemeonaProject,
): Promise<void> {
  const html =
    buildProjectHtml(project)

  /*
   * Tauri 2 does not use normal browser popups for
   * application windows. Instead, create a real Tauri
   * WebviewWindow.
   *
   * We dynamically import this so the normal web/browser
   * version of Mnemeona does not require Tauri at runtime.
   */
  const isTauri =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window

  if (isTauri) {
    const {
      WebviewWindow,
    } = await import(
      "@tauri-apps/api/webviewWindow"
    )

    const label =
      `project-pdf-${Date.now()}`

    /*
     * Load the current application page first.
     *
     * We then replace its DOM with the generated
     * print document using WebviewWindow.eval().
     *
     * This avoids data: URLs, popup blockers and
     * browser security restrictions.
     */
    const pdfWindow =
      new WebviewWindow(
        label,
        {
          title:
            `${project.title} — PDF Export`,
          width: 1000,
          height: 800,
          center: true,
          resizable: true,
          decorations: true,
          url:
            window.location.href,
        },
      )

    const printDocument =
      JSON.stringify(html)

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        let settled =
          false

        const cleanup =
          () => {
            if (settled) {
              return
            }

            settled = true
          }

        pdfWindow.once(
          "tauri://error",
          (event) => {
            cleanup()

            reject(
              new Error(
                `Could not create PDF window: ${JSON.stringify(
                  event,
                )}`,
              ),
            )
          },
        )

        pdfWindow.once(
          "tauri://created",
          async () => {
            try {
              /*
               * Give the WebView a moment to finish loading
               * the application page before replacing its DOM.
               */
              await new Promise(
                (resolveDelay) =>
                  setTimeout(
                    resolveDelay,
                    500,
                  ),
              )

              /*
               * JSON.stringify() above makes this safe to
               * inject as JavaScript.
               */
              const script = `
                (() => {
                  const html = ${printDocument};

                  document.open();
                  document.write(html);
                  document.close();
                })();
              `

              await pdfWindow.eval(
                script,
              )

              /*
               * Wait for the generated HTML and its fonts
               * to be laid out before printing.
               */
              await new Promise(
                (resolveDelay) =>
                  setTimeout(
                    resolveDelay,
                    750,
                  ),
              )

              /*
               * This is Tauri's native print command.
               *
               * It opens the operating system's print dialog,
               * where the user can select "Save as PDF".
               */
              await pdfWindow.print()

              cleanup()
              resolve()
            } catch (error) {
              cleanup()
              reject(error)
            }
          },
        )
      },
    )

    return
  }

  /*
   * Browser fallback.
   *
   * This is useful when running `npm run dev` in a normal
   * browser instead of through Tauri.
   */
  const printWindow =
    window.open(
      "",
      "_blank",
      "width=1000,height=800",
    )

  if (!printWindow) {
    throw new Error(
      "The PDF export window was blocked by the browser. Please allow pop-ups for Mnemeona.",
    )
  }

  printWindow.document.open()
  printWindow.document.write(
    html,
  )
  printWindow.document.close()

  printWindow.addEventListener(
    "afterprint",
    () => {
      printWindow.close()
    },
    {
      once: true,
    },
  )
}
