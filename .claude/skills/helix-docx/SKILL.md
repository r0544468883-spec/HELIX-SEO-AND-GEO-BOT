---
name: helix-docx
description: >
  Generate and fill Microsoft Word (.docx) documents in HELIX products using
  clean-room, MIT-licensed libraries (docx + docxtemplater) — never Anthropic's
  source-available docx skill. Use this whenever the user wants to produce a
  Word document, contract, signed agreement, proposal, quote, offer letter,
  CV/resume export, HR letter, or any .docx from data — especially in HELIX
  Sign & Forms, proposals, or the CRM. Trigger even if the user just says
  "export to Word", "make a contract", "generate a proposal doc", "מסמך וורד",
  "חוזה", "הצעת מחיר", "מכתב", without naming ".docx". Handles Hebrew/RTL text,
  Hebrew filenames (the Supabase Storage "Invalid key" trap), and template
  merge-fields. Prefer this over hand-rolling docx XML or reaching for the
  source-available Anthropic skill.
metadata:
  type: reference
license: MIT (this skill) — wraps docx (MIT) + docxtemplater (MIT)
---

# HELIX docx — Word generation the clean-room way

## Why this skill exists (read first)

Anthropic's official `docx` skill is **source-available, not open source** — it
may not be embedded in a commercial product like HELIX Sign & Forms. This skill
reaches the same capability through two permissively-licensed (MIT) libraries so
the output can ship inside a paid product with no license risk:

- **`docx`** (npm, dolanmiu, MIT) — build a document programmatically from
  scratch. Best for contracts, proposals, letters generated from structured data.
- **`docxtemplater`** (npm, MIT core) — fill `{placeholders}` in a hand-designed
  `.docx` template. Best when a human designed the layout in Word and you only
  inject values (Sign & Forms contract templates, branded proposals).

Pick `docx` when *code owns the layout*; pick `docxtemplater` when *a Word
template owns the layout*. Do not copy code from the Anthropic skill — reimplement
the capability with these libraries.

## The two traps that bite us every time

### 1. Hebrew / spaced filenames break Supabase Storage upload

Uploading `הצעת מחיר סופית.docx` to Supabase Storage fails with `Invalid key`.
This has bitten PlugChat and ResumeUpload before. **Always** sanitize the storage
key (keep a human-readable `title` separately for the download filename):

```ts
// storage key only — safe ASCII. Keep the real title for Content-Disposition.
const storageKey = original
  .replace(/[^\x00-\x7F]/g, "")   // strip non-ASCII (Hebrew, emoji)
  .replace(/\s+/g, "_")            // no spaces
  .replace(/_+/g, "_")             // collapse repeats
  .replace(/^_|_$/g, "");          // trim edges
// e.g. "הצעת מחיר סופית.docx" -> ".docx"  ← empty! guard it:
const safeKey = (storageKey.replace(/\.docx$/i, "") || `doc-${Date.now()}`) + ".docx";
```

When Hebrew strips to empty, fall back to a slug/id — never upload a bare
extension. Serve the pretty Hebrew name via `Content-Disposition: attachment;
filename*=UTF-8''<encodeURIComponent(title)>` at download time.

### 2. RTL / Hebrew renders left-aligned and mirrored if you don't set it

Word does not infer RTL from the characters. Set it explicitly on every
paragraph and table that holds Hebrew, or the contract looks broken to the client.

```ts
import { Paragraph, TextRun, AlignmentType } from "docx";

new Paragraph({
  bidirectional: true,               // RTL paragraph
  alignment: AlignmentType.RIGHT,
  children: [new TextRun({ text: "הסכם התקשרות", bold: true, rightToLeft: true })],
});
```

For tables holding Hebrew, set `visuallyRightToLeft: true` on the `Table` so
column order mirrors correctly. See `references/rtl-word.md` for the full table
recipe and mixed HE/EN (numbers, emails) handling.

## Workflow

1. **Decide the mode** — code-owns-layout (`docx`) vs template-owns-layout
   (`docxtemplater`). If the user has a `.docx` they designed, use docxtemplater.
2. **Install** the library in the target product repo (both MIT):
   `npm i docx` or `npm i docxtemplater pizzip`.
3. **Build/fill**, applying the two traps above.
4. **Deliver** — write to disk, or upload to Supabase Storage with a sanitized
   key + pretty download name. In an edge function, return the buffer with the
   correct `Content-Type`:
   `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
5. **Verify** it opens — a corrupt docx is worse than none. See the checklist in
   `references/verify.md`.

## Product mapping (where this is used)

- **Sign & Forms** — contract/agreement generation from a template + signer
  fields; the generated docx is the artifact that gets signed. Use docxtemplater
  against the human-designed template; never mutate the template file itself.
- **Proposals / quotes** — branded proposal from CRM deal data. `docx`
  programmatic build with the HELIX header/footer partial.
- **CRM** — HR letters, offer letters, engagement letters merged from contact
  fields. Either mode; prefer templates so non-devs can edit wording.
- **PLUG** — CV/resume export to Word (companion to the existing PDF path).

## Reference files

- `references/rtl-word.md` — full RTL recipe: paragraphs, tables, mixed HE/EN,
  page direction, common mistakes.
- `references/docxtemplater.md` — template syntax, loops, conditionals, image
  modules, error handling for missing fields.
- `references/verify.md` — post-generation checklist (opens in Word, RTL correct,
  no `Invalid key`, fonts embedded).
- `scripts/sanitizeStorageKey.ts` — the sanitizer above, importable.

## Guardrails

- Never embed or copy the Anthropic source-available docx skill's code.
- Keep the human-readable title separate from the storage key at all times.
- Don't build docx by hand-writing OOXML — the libraries exist for a reason.
- Test with a real Hebrew string every time; ASCII-only tests hide both traps.
