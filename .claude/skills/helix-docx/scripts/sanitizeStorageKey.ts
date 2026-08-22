/**
 * Sanitize a filename into a safe Supabase Storage key.
 * Hebrew/emoji/spaces in a storage key cause `Invalid key` on upload.
 * Keep the ORIGINAL title separately for the human-facing download name
 * (serve via `Content-Disposition: filename*=UTF-8''<encodeURIComponent(title)>`).
 *
 * MIT — part of the helix-docx skill (clean-room, no Anthropic code).
 */
export function sanitizeStorageKey(original: string, ext = "docx"): string {
  const base = original.replace(new RegExp(`\\.${ext}$`, "i"), "");
  const ascii = base
    .replace(/[^\x00-\x7F]/g, "") // strip non-ASCII (Hebrew, emoji)
    .replace(/\s+/g, "_") // no spaces
    .replace(/[^A-Za-z0-9._-]/g, "") // drop anything else risky
    .replace(/_+/g, "_") // collapse repeats
    .replace(/^_|_$/g, ""); // trim edges
  const safe = ascii || `doc-${Date.now()}`; // Hebrew can strip to empty
  return `${safe}.${ext}`;
}

/** Build a Content-Disposition header that preserves the Hebrew title. */
export function contentDisposition(title: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(title)}`;
}
