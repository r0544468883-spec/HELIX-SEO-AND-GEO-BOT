# Post-generation verification checklist

A corrupt or wrong-direction .docx is worse than none — it reaches the client
before you notice. Run through this before considering the task done.

- [ ] **Opens** in Word / Google Docs / LibreOffice without a repair prompt.
      (Programmatically: unzip the .docx — it's a zip; `word/document.xml` must be
      well-formed XML.)
- [ ] **Hebrew is right-aligned and reads correctly** — punctuation on the right,
      table columns mirrored. Open with a real Hebrew value, not Lorem ipsum.
- [ ] **Numbers/emails/phones** inside Hebrew are not reversed.
- [ ] **No `Invalid key`** on Supabase upload — the storage key is ASCII
      (`sanitizeStorageKey`), and the pretty Hebrew name is on the
      `Content-Disposition` header, not the key.
- [ ] **Download filename** shows the Hebrew title correctly (UTF-8 encoded).
- [ ] **Content-Type** is
      `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- [ ] **Template not mutated** (docxtemplater path) — the source template file is
      unchanged; output is a separate buffer.
- [ ] **Missing merge-fields fail loud** — no silently-blank `{amount}` in a
      contract.

Quick smoke test (Node):

```ts
import PizZip from "pizzip";
const zip = new PizZip(buffer);
if (!zip.file("word/document.xml")) throw new Error("corrupt docx");
```
