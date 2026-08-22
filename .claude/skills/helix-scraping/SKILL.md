---
name: helix-scraping
description: >
  Scrape and extract structured data from web pages in HELIX products using
  clean-room, permissively-licensed tools (Playwright + @mozilla/readability) —
  never the AGPL-3.0 Firecrawl service, whose copyleft can infect a commercial
  product. Use whenever the user wants to scrape a site, enrich a lead from a
  company website, extract article/company data, crawl competitor pages, or
  gather signals from the web — especially HELIX SDR-BDR enrichment, Rank
  competitor research, and PIXEL intent signals. Trigger on "scrape", "enrich
  this lead", "pull data from their site", "crawl competitors", "לגרד אתר",
  "להעשיר ליד", without naming a tool. Bakes in politeness/rate-limits and the
  Israeli privacy (תיקון 13) note. Prefer this over Firecrawl for anything that
  ships in a product.
metadata:
  type: reference
license: MIT (this skill) — wraps Playwright (Apache-2.0) + @mozilla/readability (Apache-2.0/MPL)
---

# HELIX scraping — web extraction without the AGPL trap

## Why this skill exists
Firecrawl's official plugin is **AGPL-3.0** — copyleft that can obligate you to
open-source a product that links it. For anything embedded in a HELIX product,
use **Playwright** (Apache-2.0) to fetch/render + **@mozilla/readability** to pull
clean main-content. Firecrawl is fine only as an external, arms-length service
you call over HTTP — never vendored into product code.

## HELIX rules baked in

### Extraction recipe
```ts
import { chromium } from "playwright";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: HELIX_UA });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
const html = await page.content();
const doc = new JSDOM(html, { url }).window.document;
const article = new Readability(doc).parse(); // { title, textContent, ... }
```
For structured fields (emails, phone, company size) run targeted selectors /
regex on the cleaned text — don't feed raw nav/footer noise to the LLM.

### Be polite (and hard to block)
- Respect `robots.txt`; set a real HELIX user-agent with a contact URL.
- Rate-limit per host (≥1s between requests); back off on 429.
- Cache by URL — never re-fetch the same page inside a run.
- Prefer the site's own API/sitemap when it exists over crawling.

### Own-first enrichment (SDR principle)
Before hitting the open web, check data we already hold (CRM, prior enrichment).
Scrape only the gaps. Cheaper, faster, and less exposure.

### Privacy — תיקון 13 / GDPR
Personal data pulled from the web is still regulated. Store only what's needed for
the stated purpose, record the source+timestamp, and honor deletion. This is the
PIXEL/Maintenance moat — don't undercut it with sloppy scraping. See the
privacy note before scraping anything with personal data.

## Product mapping
- **SDR-BDR** — enrich a lead from the company site (own-first, then scrape gaps).
- **Rank** — competitor page/content research (public pages, polite crawl).
- **PIXEL** — intent/behavior signals from the open web.

## Guardrails
- Never vendor Firecrawl (AGPL) into product code; external HTTP call only if used.
- robots.txt + rate-limit + real UA, always.
- Personal data → minimize, source-stamp, honor deletion (תיקון 13).
- Extract clean main-content (Readability), don't dump raw HTML into the model.
