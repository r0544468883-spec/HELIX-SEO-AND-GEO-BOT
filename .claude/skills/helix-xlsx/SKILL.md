---
name: helix-xlsx
description: >
  Generate Excel (.xlsx) files in HELIX products using the clean-room,
  MIT-licensed ExcelJS library — never Anthropic's source-available xlsx skill.
  Use whenever the user wants to export data to Excel, produce a spreadsheet,
  a report with formulas, a downloadable data table, a financial/BI export, or
  any .xlsx — especially in HELIX Dashboards, CRM, and Rank reports. Trigger even
  on "export to Excel", "download as spreadsheet", "קובץ אקסל", "דוח", "טבלה
  להורדה", without naming ".xlsx". Handles Hebrew/RTL sheets, ₪ currency
  formatting, large streaming exports, and the Supabase Hebrew-filename trap.
  Prefer this over hand-writing spreadsheet XML or the source-available skill.
metadata:
  type: reference
license: MIT (this skill) — wraps ExcelJS (MIT)
---

# HELIX xlsx — Excel generation the clean-room way

## Why this skill exists
Anthropic's `xlsx` skill is **source-available, not open source** — it can't ship
inside a paid product. **ExcelJS** (MIT) reaches the same capability with a clean
license and streams large files, which BI exports need. Do not copy the Anthropic
skill's code; reimplement with ExcelJS.

## HELIX rules baked in

### RTL worksheet (Hebrew reports render backwards otherwise)
```ts
import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("דוח", { views: [{ rightToLeft: true }] }); // sheet flows RTL
ws.columns = [
  { header: "שם", key: "name", width: 24 },
  { header: "סכום", key: "amount", width: 16, style: { numFmt: '#,##0 "₪"' } },
];
```
`rightToLeft: true` on the view mirrors columns; without it a Hebrew report opens
with column A on the left and reads wrong to the client.

### Currency / numbers
Use `numFmt: '#,##0 "₪"'` for shekel, `'0.0%'` for rates. Store real numbers, not
strings like `"₪12,000"` — the client must be able to sum/filter.

### Large exports → stream, don't buffer
For CRM/Dashboards exports over ~10k rows, use the streaming writer so the edge
function doesn't OOM:
```ts
const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
const ws = wb.addWorksheet("data");
for (const row of rows) ws.addRow(row).commit();
await wb.commit();
```

### Hebrew filename on Supabase
Reuse `sanitizeStorageKey` from the [[helix-docx]] skill — ASCII storage key,
Hebrew title on `Content-Disposition`. Same `Invalid key` trap.

## Delivery
Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

## Product mapping
- **Dashboards** — "export this widget/board to Excel" for clients who want to
  slice data themselves (not everyone wants live BI).
- **CRM** — contacts/deals export, pipeline reports.
- **Rank** — keyword/ranking reports as a downloadable deliverable.

## Guardrails
- Never embed the Anthropic source-available xlsx code.
- Numbers as numbers (with `numFmt`), never pre-formatted strings.
- Always set `rightToLeft` on Hebrew sheets and test with a Hebrew header.
