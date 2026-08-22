---
name: helix-ocr
description: >
  Extract text from images and scanned documents in HELIX products using the
  clean-room, Apache-2.0 Tesseract engine (with a cloud fallback). Use whenever
  the user wants OCR, to read a scanned CV/resume, pull data off an invoice or
  receipt, digitize a photographed document, or turn an image into text —
  especially PLUG (scanned CVs) and CRM (invoices/receipts). Trigger on "OCR",
  "read this scan", "extract text from image", "digitize this invoice", "לקרוא
  מסמך סרוק", "קליטת חשבונית", without naming a tool. Bakes in Hebrew-OCR
  accuracy caveats and the human-in-the-loop rule for money fields.
metadata:
  type: reference
license: MIT (this skill) — wraps Tesseract (Apache-2.0) + optional cloud OCR
---

# HELIX ocr — image/scan to text

## What this wraps
- **Tesseract** (Apache-2.0, via `tesseract.js` or native) with the `heb`
  traineddata — self-hosted, free, private. Good for clean scans; struggles with
  low-res photos and handwriting.
- **Cloud OCR** (Google Vision, Azure) — much better on messy real-world photos
  and Hebrew, but the image leaves your infra. Use as a fallback when Tesseract
  confidence is low, with consent for personal docs.

## HELIX rules baked in

### Hebrew OCR is the hard part — plan for errors
- Load the `heb` language data (`tesseract.js` needs `lang: "heb"` or `"heb+eng"`
  for mixed docs). Israeli documents are almost always mixed HE/EN.
- Accuracy on photographed (not scanned) Hebrew is low. Pre-process: greyscale,
  increase contrast, deskew, upscale — it moves accuracy more than model choice.
- Report a confidence score; below a threshold, route to cloud or to a human.

### Never trust OCR on money/ID fields without confirmation
An OCR'd invoice total or ID number that's wrong creates a real liability. For
CRM invoices, show the extracted value next to the source crop and require a
one-click human confirm before it's saved. Human-in-the-loop, always, for
money and identity fields.

### Structured extraction, not just text
After OCR, extract fields (total, date, vendor, ID) with regex/LLM — but feed the
LLM the cleaned OCR text plus the confidence, so it can flag uncertainty rather
than confidently emit a misread number.

## Product mapping
- **PLUG** — scanned/photographed CV → profile fields (pairs with [[helix-pdf]]).
- **CRM** — invoice/receipt → expense record; ID doc → contact (with confirm).

## Guardrails
- Load `heb+eng`; pre-process the image before blaming the engine.
- Emit confidence; low confidence → cloud fallback or human.
- Money/ID fields require human confirmation before save.
- Personal docs → consent + minimize + delete (תיקון 13).
