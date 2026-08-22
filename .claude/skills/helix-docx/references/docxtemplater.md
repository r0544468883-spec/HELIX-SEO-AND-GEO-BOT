# docxtemplater — fill a human-designed Word template

Use when a person designed the layout in Word and code only injects values
(Sign & Forms contract templates, branded proposals). The template file is an
asset; never mutate it — load, render into a fresh buffer, output the copy.

## Basic render

```ts
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { readFileSync } from "node:fs";

const zip = new PizZip(readFileSync("templates/contract.docx"));
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
doc.render({
  client_name: "אבנר כהן",
  amount: "₪12,000",
  date: "22.08.2026",
  items: [{ desc: "ליווי חודשי", qty: 1, price: "₪3,900" }],
});
const buf = doc.getZip().generate({ type: "nodebuffer" });
```

Template placeholders: `{client_name}`, loops `{#items}{desc} — {price}{/items}`,
conditionals `{#is_vat}כולל מע"מ{/is_vat}`.

## Missing fields — fail loud, not silently blank

By default a missing field throws at render. Keep it that way for contracts — a
blank `{amount}` in a signed agreement is a liability. Catch and surface which
tags failed:

```ts
try {
  doc.render(data);
} catch (e: any) {
  const tags = (e.properties?.errors ?? []).map((x: any) => x.properties?.id);
  throw new Error(`Contract template missing fields: ${tags.join(", ")}`);
}
```

## RTL in templates

RTL is set by the person who designed the template in Word (paragraph direction
+ right alignment). docxtemplater preserves it — you don't set direction in code.
This is a reason to prefer templates for Hebrew contracts: the layout is
WYSIWYG-correct before code touches it.

## Images / signatures

For inserting a signature image at sign time, add the open-source
`docxtemplater-image-module-free` (MIT) or composite the signature at PDF-export
time instead. Keep the paid image module out unless licensed.
