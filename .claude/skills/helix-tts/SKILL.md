---
name: helix-tts
description: >
  Turn text into natural speech in HELIX products — audio summaries, voice notes,
  and IVR-style replies. Use whenever the user wants text-to-speech, a spoken
  summary, a voice message from a bot, an audio version of content, or Hebrew
  narration — especially HELIX Meeting (spoken recaps) and WhatsApp bots (voice
  replies). Trigger on "text to speech", "read this out loud", "voice note from
  the bot", "audio summary", "הקראה", "הודעה קולית", "טקסט לדיבור", without
  naming a provider. Bakes in Hebrew-voice-quality caveats and per-minute cost
  awareness.
metadata:
  type: reference
license: MIT (this skill) — wraps a TTS API (ElevenLabs / Azure / Google)
---

# HELIX tts — text-to-speech for bots & Meeting

## What this wraps (pick by Hebrew quality + cost)
- **ElevenLabs** — best Hebrew naturalness today; per-character cost. Use for
  customer-facing audio where quality sells.
- **Azure / Google Neural TTS** — cheaper at volume, decent Hebrew, more voices
  and SSML control. Use for high-volume bot replies.

Hebrew TTS is still weaker than English — always listen to a real sample before
shipping a voice; some voices mangle nikud-less Hebrew and numbers.

## HELIX rules baked in

### Cost is per-minute/character — cache and gate
Audio is not free like text. Cache generated audio by content hash (identical
summary → reuse the file), and gate generation behind a real user action, not on
every page load. Track spend per product.

### SSML for numbers, dates, currency
Raw "₪3,900" or "22.08.2026" reads wrong. Use SSML `say-as` (or pre-normalize to
Hebrew words) so prices and dates sound natural.

### Deliver as a file, not a blob in the DB
Write the MP3/OGG to Supabase Storage (sanitize the key — see [[helix-docx]]),
serve a signed URL. For WhatsApp voice notes, OGG/Opus is the expected format.

## Product mapping
- **Meeting** — spoken recap of a meeting for people who'd rather listen.
- **WhatsApp bots** — voice-note replies for a human touch.
- **Site/content** — "listen to this article" audio for accessibility + reach.

## Guardrails
- Audition a real Hebrew sample before shipping any voice.
- Cache by content hash; gate on user action; track per-product cost.
- Normalize numbers/dates/currency via SSML.
- Store as a file with a sanitized key; serve signed URLs.
