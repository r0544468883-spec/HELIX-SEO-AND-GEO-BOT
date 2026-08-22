# RTL / Hebrew in Word (docx library)

Word never infers direction from characters. Set it explicitly or Hebrew renders
left-aligned with mirrored punctuation and reversed table columns.

## Paragraph

```ts
import { Paragraph, TextRun, AlignmentType } from "docx";

new Paragraph({
  bidirectional: true,              // marks the paragraph RTL
  alignment: AlignmentType.RIGHT,
  children: [new TextRun({ text: "סעיף 1 — הגדרות", bold: true, rightToLeft: true })],
});
```

`bidirectional` (paragraph) and `rightToLeft` (run) are both required — one sets
flow, the other sets the run's script direction.

## Table

```ts
import { Table, TableRow, TableCell } from "docx";

new Table({
  visuallyRightToLeft: true,        // mirror column order for RTL
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [rtlParagraph("תיאור")] }),
        new TableCell({ children: [rtlParagraph("כמות")] }),
        new TableCell({ children: [rtlParagraph("מחיר")] }),
      ],
    }),
  ],
});
```

Without `visuallyRightToLeft` the first cell lands on the left — wrong for Hebrew.

## Mixed HE/EN (numbers, emails, URLs)

Numbers, emails and Latin words inside Hebrew are handled by the bidi algorithm
automatically **once the paragraph is `bidirectional`**. Do NOT wrap them in LTR
marks manually unless a specific value renders reversed (rare: standalone `+972`
phone numbers). If a phone/IBAN renders backwards, wrap just that run with
Unicode LRM: `"\u200E" + value + "\u200E"`.

## Page-level direction (whole document RTL)

Set the default paragraph style + section to RTL so empty paragraphs and page
breaks also flow right-to-left:

```ts
import { Document } from "docx";
new Document({
  styles: { default: { document: { run: { rightToLeft: true } } } },
  sections: [{ properties: {}, children: [...] }],
});
```

## Common mistakes

- Setting `alignment: RIGHT` but forgetting `bidirectional` → punctuation like
  `.` and `,` jump to the wrong side.
- Building a table without `visuallyRightToLeft` → columns read left-to-right.
- Testing only with English strings → both bugs stay invisible until a client
  opens a Hebrew contract. Always include a Hebrew string in tests.
