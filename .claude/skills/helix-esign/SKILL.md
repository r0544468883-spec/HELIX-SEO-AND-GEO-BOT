---
name: helix-esign
description: >
  Implement the e-signature flow in HELIX Sign & Forms — capture a signature,
  stamp it onto the document, flatten it, and record a tamper-evident audit
  trail. Use whenever the user works on signing, signature capture, "sign this
  contract", signer fields, signing order, an audit trail for a signed document,
  or making a document legally binding — especially HELIX Sign & Forms. Trigger
  on "e-signature", "sign the document", "signature pad", "signing flow", "audit
  trail", "חתימה דיגיטלית", "החתמה על חוזה", without naming a library. Draws a
  hard line between technical integrity (this skill) and legal validity in Israel
  (a separate legal question). This is the core of Sign & Forms.
metadata:
  type: reference
license: MIT (this skill) — composes pdf-lib (MIT) + signature_pad (MIT)
---

# HELIX esign — signature capture, stamping, and audit

## Technical vs legal — read this first
This skill covers **technical integrity**: capturing a signature, binding it to a
document, and proving it wasn't altered. **Legal validity** of an electronic
signature in Israel (חוק חתימה אלקטרונית 2001, and what counts as a "secure"
vs "regular" electronic signature) is a **product/legal question**, not a coding
one. Don't claim legal bindingness in the product without legal sign-off. Building
this well is necessary but not sufficient for "legally binding".

## The flow (Sign & Forms core)
1. **Capture** — draw with `signature_pad` (MIT) on a canvas, or type/adopt a
   styled name. Export a transparent PNG.
2. **Bind** — stamp the signature PNG onto the contract PDF at the signer's field
   with [[helix-pdf]] (pdf-lib). Also stamp: signer name, timestamp (UTC + TZ),
   and a document hash reference.
3. **Flatten** — flatten form fields so nothing can be edited post-signature.
4. **Hash + audit** — SHA-256 the final bytes; write an audit row: who, when,
   IP/user-agent, email verification, and the hash. This is the evidence trail.
5. **Multi-signer** — enforce signing order server-side; each signer sees the
   doc state after prior signatures; re-hash after each.

## HELIX rules baked in
- **Audit table is append-only** — RLS: signers insert their own audit row via a
  server path (service role writes completion), nobody updates/deletes. (See the
  Sign & Forms `signing_document_audit` policy — keep it `TO authenticated`,
  never `USING(true)` for write.)
- **Verify identity before signing** — at minimum email OTP; the audit is only as
  strong as the identity check behind it.
- **Immutable artifact** — store the flattened, hashed PDF; never re-open and
  re-save the signed file. Reuse the storage-key sanitizer from [[helix-docx]].
- **RTL** — Hebrew contracts need the [[helix-pdf]] Hebrew-font + right-align
  rules, or the signed doc looks broken.

## Product mapping
- **Sign & Forms** — the whole reason the product exists; this is its spine.
- **CRM** — send an engagement/offer letter for signature from a deal.

## Guardrails
- Separate technical integrity (here) from legal validity (get legal sign-off).
- Flatten + hash + append-only audit — no editable signed docs.
- Identity check (OTP min) before signature; record it in the audit.
- Never weaken the audit-table RLS to `USING(true)` for writes.
