---
name: helix-stt
description: >
  Transcribe speech to text (with speaker diarization) in HELIX products —
  the core capability behind HELIX Meeting. Use whenever the user wants to
  transcribe audio/video, get meeting notes from a recording, caption a call,
  turn a voice note into text, or extract who-said-what — especially HELIX
  Meeting and any bot that ingests voice. Trigger on "transcribe", "meeting
  notes from recording", "who said what", "caption this call", "תמלול", "סיכום
  פגישה מהקלטה", without naming a provider. Bakes in Hebrew-accuracy caveats,
  diarization, and the private-vs-cloud decision (privacy moat).
metadata:
  type: reference
license: MIT (this skill) — wraps faster-whisper (MIT) or a cloud STT API
---

# HELIX stt — speech-to-text for Meeting & voice bots

## What this wraps (pick by privacy + Hebrew accuracy)
- **faster-whisper** (MIT) / OpenAI Whisper — self-hostable, no data leaves your
  infra. Best when privacy is the pitch (Meeting's on-prem angle). Hebrew works
  but is weaker than English; use `large-v3` for Hebrew, not `base`.
- **Cloud STT** (Deepgram, AssemblyAI, Google) — better diarization + realtime,
  but audio leaves your infra. Only with explicit consent + a DPA.

The choice IS the product decision: Meeting's differentiator is privacy, so
default to self-hosted Whisper unless the customer opts into cloud.

## HELIX rules baked in

### Hebrew accuracy
- Use the largest model you can afford; small models hallucinate Hebrew.
- Provide domain vocabulary (product names, people) as a prompt/hotwords list to
  cut misrecognitions.
- Expect mixed HE/EN in Israeli meetings — Whisper handles code-switching; set
  language to `auto` or run detection, don't hard-pin `he`.

### Diarization (who said what)
6 signal types in Meeting depend on attributing lines to speakers. Whisper alone
doesn't diarize — pair with `pyannote.audio` (MIT, but model weights need a HF
license acceptance) or a cloud provider that includes diarization.

### Consent + retention (privacy moat)
Recording people is regulated (תיקון 13). Capture consent, state retention, and
let users delete a transcript + its audio. Don't keep raw audio longer than needed.

## Product mapping
- **Meeting** — the core: transcript → the 6 signals that feed SDR/OPS/GEO/Dashboards.
- **SDR** — transcribe discovery calls → enrich the deal.
- **WhatsApp/voice bots** — voice note → text → intent.

## Guardrails
- Default to self-hosted Whisper for privacy-sensitive Meeting audio.
- Largest model for Hebrew; feed domain hotwords.
- Consent + deletion for any recorded human (תיקון 13). Pair with [[helix-scraping]]'s privacy stance.
