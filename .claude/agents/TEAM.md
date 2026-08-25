# helix-rank — Agent Team

This product is a **department of agents** (HELIX intra-department architecture).
The specialists below live in this repo's `.claude/agents/`, so the team is
versioned with the product.

## How it fits the methodology
- **Orchestrator** — `multi-agent-coordinator` runs the department: splits the
  task, dispatches specialists, reconciles their output.
- **Specialists (Researcher / Maker / Critic)** for this product:
  - `seo-specialist`
  - `ai-writing-auditor`
  - `content-quality-editor`
  - `trend-analyst`
- **Tools they use** — the product's `helix-*` skills (pdf / tts / clean-text /
  screen-recording / email-campaigns …) are the *capabilities*; these agents are
  the *workers* that wield them.
- **Existing product agent** — these AUGMENT the product's own agent/chief
  (CHIEF / department-chief); they do not replace it. The product agent stays the
  front door; specialists are summoned by name when their domain comes up.
- **Autonomy** — all run under the product's autonomy mode
  (advisor → approve → autopilot).

## Use
Invoke a specialist by name, or let `multi-agent-coordinator` assemble the team
for a multi-step job. They are also globally available; this file makes the
product's *dedicated* roster explicit.
