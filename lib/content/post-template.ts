/** Starter Markdown for "Import .md" on the Blog list. Comments are guidance; the importer skips them. */
export const POST_TEMPLATE = `---
# ─── Post details ──────────────────────────────────────────────
# Only "title" is required. Everything else can be set later in the editor.
title: "Your post title"
# URL: /blog/<slug>. Lowercase words joined by hyphens. Leave out to build it from the title.
slug: your-post-title
# One of the categories in Settings → Blog page (e.g. Engineering).
category: Engineering
tags: [Next.js, React]
# One or two sentences, shown on cards, in search results and in social previews.
excerpt: "What the reader learns, in plain words."
# Up to 4 terminal-style lines on the generated cover: cmd (a command), ok (a result), plain.
coverLines:
  - cmd "npm run build"
  - ok "compiled successfully"
  - plain "a short closing line"
# Optional search-engine overrides (leave out to use the title and excerpt).
# seoTitle: "Title for Google, about 60 characters"
# seoDescription: "Description for Google, about 155 characters"
---

<!--
HOW THIS FILE BECOMES A POST
Blog → Import .md → choose this file. It opens as a DRAFT in the editor.
Nothing goes live until you review it and click Publish.

DO
- Use ## for sections (they build the table of contents) and ### for sub-sections.
- Keep paragraphs short: 2 to 4 sentences.
- Give every code block a language, and a title when it's a real file.
- Use **bold** for key terms and \`backticks\` for code, file names and commands.
- Use https:// links (or /paths on this site). Other link types are removed.
- Write the excerpt last, once you know what the post says.

DON'T
- Don't add a "# Title" heading below this block: the title comes from "title:" above.
  (If you leave "title:" out, the first # heading is used instead.)
- Don't paste images: they're skipped. Add them in the editor with Image (from Media),
  so they get alt text and fast loading.
- Don't rely on tables: the editor has no table block, so each row becomes a bullet
  ("First cell: the other cells"). Fine for short comparisons; check how it reads.
- Don't use HTML tags: they're dropped. Comments like this one are ignored.
- Don't use languages other than TypeScript, TSX, CSS, JSON or Shell for code:
  JavaScript is shown as TypeScript, and anything else as plain text.

After importing, the editor lists anything it skipped or changed.
-->

Open with the problem or the moment that started this post. One short paragraph that tells the reader why it's worth their time.

## First section

Normal paragraphs, with **bold**, *italic*, \`inline code\` and [a link](https://example.com).

- A bulleted list item
- Another item

1. A numbered step
2. The next step

## A section with code

Add a title and highlighted lines in the fence: \`title="file"\` and \`{2-3}\`.

\`\`\`ts title="lib/example.ts" {2-3}
export function add(a: number, b: number) {
  const sum = a + b;
  return sum;
}
\`\`\`

\`\`\`shell
npm install
\`\`\`

## Callouts and quotes

> **Takeaway:** A quote that starts with a bold label becomes a callout box, with the label as its kicker. Keep it to one paragraph.

> [!NOTE]
> This form works too, and uses "Note" as the kicker.

> Any other quote stays a normal quote.

## Wrap-up

End with what the reader should remember or do next.
`;
