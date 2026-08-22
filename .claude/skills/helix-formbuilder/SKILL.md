---
name: helix-formbuilder
description: >
  Build dynamic, schema-driven forms in HELIX products — the data-collection half
  of HELIX Sign & Forms, plus intake/lead forms elsewhere. Use whenever the user
  wants a form builder, a dynamic form, a multi-step form/wizard, conditional
  fields, an intake or onboarding form, or validation on collected data —
  especially HELIX Sign & Forms (fill-before-sign) and any product's lead/intake
  capture. Trigger on "form builder", "dynamic form", "intake form", "multi-step
  form", "conditional fields", "טופס דינמי", "טופס לפני חתימה", "טופס לידים",
  without naming a library. Bakes in RTL, a JSON schema contract, and validation
  with react-hook-form + zod.
metadata:
  type: reference
license: MIT (this skill) — composes react-hook-form (MIT) + zod (MIT)
---

# HELIX formbuilder — schema-driven dynamic forms

## The model: one JSON schema drives render + validate + store
A form is data, not hardcoded JSX. Define fields as a JSON schema; render from it,
validate from it, and store submissions against it. This lets non-devs edit forms
(the Sign & Forms selling point) and keeps render/validation in sync.

```ts
// field schema (stored in DB, editable by product users)
type Field = {
  id: string; type: "text"|"email"|"select"|"date"|"checkbox"|"signature";
  label: string; required?: boolean; options?: string[];
  showIf?: { field: string; equals: string };   // conditional
};
```
- **Render** — map schema → inputs (shadcn/ui in PLUG, the product's kit elsewhere).
- **Validate** — build a `zod` schema from the field schema; drive with
  `react-hook-form`. One source of truth, client + server.
- **Conditional fields** — `showIf` hides/shows; validation must skip hidden
  fields (don't require a field the user can't see).

## HELIX rules baked in
- **RTL by default** — Hebrew labels, right-aligned inputs, error text on the
  right. Follow the [[hebrew-rtl-best-practices]] rules; test with Hebrew labels.
- **Server-side validation too** — never trust the client. Re-validate the
  submission against the stored schema in an edge function before insert.
- **Submissions are scoped by RLS** — a submitter reads only their own
  submission; the form owner reads all for their form. Don't ship a
  `USING(true)` read on a submissions table (money/PII leak). Pair with
  [[supabase-postgres-best-practices]].
- **Multi-step = save progress** — persist partial state so a long intake isn't
  lost on refresh; mark `status: draft|submitted`.
- **Signature field bridges to [[helix-esign]]** — a `signature` field is the
  handoff point from fill to sign.

## Product mapping
- **Sign & Forms** — fill-before-sign forms; the data half of the product.
- **PLUG / CRM / site** — intake, onboarding, lead-capture, application forms.

## Guardrails
- Schema drives render + validation + storage — never diverge them.
- Validate server-side against the stored schema; client validation is UX only.
- Scope submissions with real RLS, never `USING(true)`.
- RTL + Hebrew-label testing before shipping.
