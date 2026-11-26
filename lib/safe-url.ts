/**
 * Link targets that are safe to render from editable content: web, mail and phone links, and
 * same-site paths/anchors. Anything else (javascript:, data:, vbscript:, …) becomes "#".
 */
export function safeHref(href: unknown): string {
  const h = String(href ?? "").trim();
  if (!h) return "#";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters can hide a scheme
  if (/[\u0000-\u001f\u007f]/.test(h)) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (/^[/#?]/.test(h) && !/^\/[/\\]/.test(h)) return h;
  return "#";
}
