---
name: helix-pptx
description: >
  Generate PowerPoint (.pptx) decks in HELIX products using the clean-room,
  MIT-licensed PptxGenJS library — never Anthropic's source-available pptx skill.
  Use whenever the user wants to build a slide deck, sales presentation, pitch,
  client report as slides, or any .pptx — especially HELIX SDR sales decks and
  Dashboards presentation exports. Trigger on "make a deck", "presentation",
  "slides for the client", "מצגת", "דק מכירה", without naming ".pptx". Handles
  Hebrew/RTL text and per-product brand accent colors. Prefer this over the
  source-available skill or hand-built OOXML.
metadata:
  type: reference
license: MIT (this skill) — wraps PptxGenJS (MIT)
---

# HELIX pptx — PowerPoint generation the clean-room way

## Why this skill exists
Anthropic's `pptx` skill is **source-available, not open source**. **PptxGenJS**
(MIT) generates decks from JS/TS — matching the HELIX stack — with a clean license
for shipping inside paid products. Don't copy the Anthropic skill; reimplement.

## HELIX rules baked in

### RTL / Hebrew text
PptxGenJS renders LTR by default. For Hebrew, right-align and set `rtlMode`:
```ts
import pptxgen from "pptxgenjs";
const pptx = new pptxgen();
const slide = pptx.addSlide();
slide.addText("הצעה עסקית", { x: 0.5, y: 0.4, w: 9, align: "right", rtlMode: true,
  fontFace: "Arial", fontSize: 28, bold: true, color: accentHex });
```

### Per-product brand accent (feedback: every product = its own color)
Take the accent from the product, don't hardcode HELIX-green. Pass an `accentHex`
and use it for titles, bars, and the footer rule. Global CTA stays HELIX-green;
the deck body wears the product's color.

### Master slide for consistency
Define one master with the HELIX/product logo, footer, and accent, then every
slide inherits it — avoids per-slide drift:
```ts
pptx.defineSlideMaster({ title: "HELIX", background: { color: "0B0F14" },
  objects: [{ line: { x: 0.5, y: 6.9, w: 9, h: 0, line: { color: accentHex, width: 2 } } }] });
```

## Product mapping
- **SDR-BDR** — auto-generated sales deck personalized per prospect from enriched
  data; the leave-behind after a call.
- **Dashboards** — export a board as a client-ready slide summary for QBRs.
- **Proposals** — visual proposal variant alongside the [[helix-docx]] Word one.

## Guardrails
- Never embed the Anthropic source-available pptx code.
- Accent = the product's color, not HELIX-green (except global CTA).
- Test one Hebrew slide — RTL bugs hide behind English placeholder text.
