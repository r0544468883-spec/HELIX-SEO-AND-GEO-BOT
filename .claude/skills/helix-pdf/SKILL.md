---
name: helix-pdf
description: >
  Create, fill, merge, and manipulate PDF files in HELIX products using the
  clean-room, MIT-licensed pdf-lib library — never Anthropic's source-available
  pdf skill. Use whenever the user wants to generate a PDF, fill a PDF form,
  merge/split PDFs, stamp a signature, flatten a signed document, export a CV,
  or produce the final signed artifact — especially HELIX Sign & Forms and PLUG
  CV export. Trigger on "make a PDF", "fill this form", "sign the document",
  "merge PDFs", "קובץ PDF", "חתימה על מסמך", "לייצא קורות חיים", without naming
  ".pdf". Handles Hebrew font embedding, file-size control, and the Supabase
  Hebrew-filename trap. Prefer this over the source-available skill.
metadata:
  type: reference
license: MIT (this skill) — wraps pdf-lib (MIT) + @pdf-lib/fontkit (MIT)
---

# HELIX pdf — PDF generation & manipulation the clean-room way

## Why this skill exists
Anthropic's `pdf` skill is **source-available, not open source**. **pdf-lib**
(MIT) creates and edits PDFs in pure JS, ships safely in paid products, and runs
in edge functions. Do not copy the Anthropic skill; reimplement with pdf-lib.

Mode guide:
- **New PDF from HTML** (styled proposal, CV) — render HTML then print to PDF
  (Playwright/Puppeteer). Use [[helix-docx]]-style HTML → PDF for rich layout.
- **Fill / stamp / merge / flatten an existing PDF** — pdf-lib. This is the
  Sign & Forms core: take a template PDF, fill fields, stamp the signature,
  flatten so it can't be edited.

## HELIX rules baked in

### Hebrew needs an embedded font (pdf-lib default fonts are Latin-only)
Standard fonts show Hebrew as blank boxes. Embed a Hebrew TTF via fontkit:
```ts
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const heb = await pdf.embedFont(await fetch("/fonts/Rubik-Regular.ttf").then(r => r.arrayBuffer()));
page.drawText("הסכם", { font: heb, size: 14 });
```
Right-align Hebrew manually: `x = pageWidth - margin - heb.widthOfTextAtSize(text, size)`.

### File size (PLUG CV lesson: scale 3→2, JPEG quality 95→75%)
Large PDFs came from oversized raster images. Downscale and re-encode images to
JPEG ~75% before embedding; don't embed 3x-DPR screenshots. Target < 1.5 MB for
a CV so it emails and uploads cleanly.

### Signed-document integrity (Sign & Forms)
After stamping a signature, **flatten** form fields so the signed values can't be
altered, and record a hash in the audit table. The signed PDF is a legal artifact.

### Hebrew filename on Supabase
Reuse `sanitizeStorageKey` from [[helix-docx]] — ASCII key, Hebrew title on the
`Content-Disposition` header.

## Product mapping
- **Sign & Forms** — fill contract PDF, stamp signature, flatten, hash → the
  signed artifact. (Legal validity in Israel is a product/legal question beyond
  this skill; this handles the technical integrity only.)
- **PLUG** — CV/resume export with size control.
- **CRM / proposals** — final PDF of the Word/HTML proposal for sending.

## Guardrails
- Never embed the Anthropic source-available pdf code.
- Always embed a Hebrew font before drawing Hebrew — silent blank boxes otherwise.
- Flatten signed documents; never leave signature fields editable.
- Compress images; test the output size, not just that it opens.
