# Portfolio Website — Execution Plan & GPT Codex/Claude Code Handoff

**Owner:** Tristan (solo freelance web developer, Quezon City, PH) **Created:** July 8, 2026 · **Target: v1 live within this week (earliest: tonight)** **Purpose of this file:** complete context transfer to GPT Codex/Claude Code. Everything needed to start building immediately is here; no other chat context required.

---

## 1\. Confirmed decisions (do not re-litigate)

| Decision | Value |
| :---- | :---- |
| Brand | Personal freelancer brand (Tristan), NOT "DDM". DDM packages presented as "my website packages" |
| Primary audience | PH local-business owners (restaurants, cafés, clinics) — the DDM client funnel |
| Secondary audience | Future higher-end clients reading technical case studies |
| Pricing on site | **None public.** Package tiers shown by name \+ inclusions only ("email me for a quote") |
| Contact / CTA | **No form, no Messenger.** Direct contact info only: email `tristandolfo@gmail.com` (as `mailto:` links) \+ phone `0999-882-7004` (as `tel:+639998827004`). One CTA verb site-wide: **"Email me"** |
| Stack | **Astro 7** (stable, June 2026), static output, zero client-JS by default, plain CSS with `:root` design tokens (no Tailwind, no React) |
| Hosting | **Netlify free subdomain** (`<sitename>.netlify.app`) on a separate account from client/demo sites. No custom domain in v1 — post-launch upgrade (see §9) |
| Timeline | Ship-fast v1; iterate after |
| Featured projects | Kozykook-Business (commercial flagship) \+ Bday Site (technical flagship). Bubu sites included as lighter "personal/experimental" cards |

**Open items:**

1. Netlify site name (`<sitename>.netlify.app`) — pick at first deploy; use `<SITE_URL>` placeholder in canonical/OG/sitemap until then.  
2. Portrait, bio, and title/tagline: **build with clearly-marked placeholders** (`<!-- PLACEHOLDER: bio -->`, a neutral portrait block, generic tagline). Tristan will edit these himself post-build — make them trivially findable and swappable.

---

## 2\. Source material (what exists on disk)

Portfolio folder (`Projects/Portfolio/`):

- `Commercial Demos/Kozykook-Business/` — Package B one-pager (519-line HTML, 599 CSS, 138 JS). Live at kozykook.vercel.app. Currently teaser-demo mode (`noindex`, form intercept).  
- `Commercial Demos/Kozykook-Demo/` — free-demo sibling, near-identical.  
- `Personal Projects/Bday Site/` — "Vinny, at Thirty": framework-free frontend \+ Netlify Function \+ Netlify Blobs shared-state API (letters, photo gallery, editable About), offline degradation, XSS escaping, focus-trapped dialogs, reduced-motion guards. Best technical piece.  
- `Personal Projects/Bubu Letters/` \+ `Bubu Workout Website/` — single-file HTML gift sites (1.5k / 1.3k lines).

DDM folder (`Projects/DDM/`) — business context only, do not modify:

- Tiers: **A Starter ₱8–12k · B Business ₱15–30k · Premier ₱40k+**; retainers **Care / Care+ (default) / Growth (SEO flagship)**. Names may appear on the portfolio; prices must not.  
- Design DNA shared across builds: Fraunces \+ Hanken Grotesk, editorial section bands, `.panel` grounded-panel system, one spacing scale, `:root` brand tokens.  
- Standing QA rule to reuse: pre-launch grep for leftover placeholder strings must return zero.

---

## 3\. Information architecture

/                      Home

/work/                 Project index (grid)

/work/\[slug\]/          Case studies (content collection)

/services/             Packages by outcome, no prices

/about/                Bio \+ capabilities \+ contact (email \+ phone, direct links)

404

**Home page sections (in order):** hero (who/what/for whom \+ "Email me") → proof strip (live-site links) → featured work (Kozykook-Business, Bday Site) → services overview (3 tiers, outcome-framed) → process ("how a build works": demo → build → live in days, not months) → about teaser → CTA band → footer.

Rationale: local-business owners buy outcomes and trust; technical depth lives inside case studies for the secondary audience.

---

## 4\. Design direction

- Extend the proven design language, new personal palette (must NOT read as a Kozykook clone). Token-driven theming in `:root` — the site is itself a reference implementation of the methodology and a sales artifact.  
- Two typefaces max. Use Astro 6+ **Fonts API** for self-hosted loading (no render-blocking Google Fonts).  
- Editorial section bands, `.panel`\-style grounded text blocks, numbered section labels, scroll-reveal **gated on `prefers-reduced-motion`**.  
- Mobile-first, hard requirement: traffic arrives from Facebook/Messenger on phones.  
- Accessibility: AA contrast, semantic landmarks, focus-visible styles, inline SVG icons (never emoji as UI).

---

## 5\. Technical architecture

portfolio/

├── astro.config.mjs          \# static output, sitemap integration

├── src/

│   ├── styles/

│   │   ├── tokens.css        \# :root design tokens (colors, type, spacing, radius)

│   │   └── global.css        \# reset \+ base \+ shared patterns (.panel, .section-head)

│   ├── layouts/

│   │   ├── Base.astro        \# \<head\>, meta/OG/JSON-LD, header, footer

│   │   └── CaseStudy.astro

│   ├── components/

│   │   ├── SectionBand.astro

│   │   ├── ProjectCard.astro

│   │   ├── CTA.astro         \# "Email me" mailto \+ tel — single source of truth for contact info

│   │   └── ProcessSteps.astro

│   ├── content/

│   │   ├── config.ts         \# zod schema below

│   │   └── projects/         \# one .md per project

│   └── pages/

│       ├── index.astro

│       ├── work/index.astro

│       ├── work/\[slug\].astro

│       ├── services.astro

│       ├── about.astro

│       └── 404.astro

├── public/                   \# favicons, og-image, robots.txt

└── netlify.toml              \# security headers (copy pattern from Kozykook netlify.toml)

**Project content schema (`src/content/config.ts`):**

projects: {

  title: string

  slug: string

  kind: 'commercial' | 'personal'

  featured: boolean

  clientType: string          // "Korean diner & bar, QC"

  stack: string\[\]             // \["HTML/CSS/JS", "Netlify Functions", ...\]

  liveUrl?: string

  year: number

  summary: string             // one-liner for cards

  outcome?: string            // plain-language result, shown on card

  cover: image

}

Case-study body \= markdown: problem → approach → result, plain-language top, technical appendix bottom.

**Engineering rules (from Tristan's design principles):** one correct path, no fallbacks; no premature abstraction — a component earns existence by being used twice; zero client-side JS unless a feature demands it (nav toggle \+ scroll-reveal \= one small vanilla script, same as existing sites); fail fast; all styles flow from tokens.

---

## 6\. Content plan

**Case study 1 — Kozykook (full treatment).** Angle: "A restaurant site that loads instantly and routes orders where they happen." Cover: zero-dependency build, design-token rebrand system, SEO/JSON-LD, foodpanda/Messenger routing decision, Lighthouse scores. Note demo status honestly (founding-client build).

**Case study 2 — Bday Site (full treatment, technical flagship).** Angle: "A real-time shared guestbook with zero frameworks." Cover: Netlify Blobs per-item storage (concurrent writes can't collide), localStorage-as-cache sync layer, offline degradation, image downscaling pipeline, security (escapeHTML everywhere), a11y (focus-trapped dialogs, reduced-motion). Keep the personal-gift framing — it's part of the story.

**Bubu sites:** cards only (`kind: personal`, not featured), one screenshot \+ summary each. No case-study pages in v1.

**Services page:** three tiers by name and outcome ("a polished one-page presence" / "your full menu, gallery & reviews on-site" / "custom builds"), inclusions lists, maintenance mentioned as "every site comes with a care plan" — no prices anywhere. Each tier's CTA: "Email me for a quote."

**About/Contact:** placeholder portrait block \+ `<!-- PLACEHOLDER: bio -->` copy (Tristan edits later). Contact block: `mailto:tristandolfo@gmail.com` and `tel:+639998827004` (display as 0999-882-7004), copy-to-clipboard affordance optional but not required for v1.

**Copy voice:** plain, confident, PH-context-aware; no dev jargon on Home/Services; jargon allowed in case-study appendices.

---

## 7\. SEO / performance / meta

- Unique title \+ meta description per page; canonical URLs pointing at `https://<sitename>.netlify.app`; OG image (create one branded 1200×630 for v1; per-project OG images later).  
- JSON-LD: `Person` \+ `ProfessionalService` on Home; `CreativeWork` per case study.  
- `@astrojs/sitemap`, robots.txt (allow all — this site IS indexed, unlike demos).  
- Budget: Lighthouse ≥95 all categories on mobile; zero layout shift; fonts self-hosted \+ `font-display: swap`; images as `<Image>` (Astro asset pipeline, AVIF/WebP).

---

## 8\. Build sequence & milestones

**M1 — Scaffold \+ system (Day 1):** `npm create astro@latest` (v7, minimal template) → tokens.css \+ global.css → Base layout with header/footer/meta → CTA \+ SectionBand \+ ProjectCard components → deploy pipeline to Netlify immediately (deploy from day one, not at the end).

**M2 — Home \+ Work index (Day 1–2):** All home sections with real copy; content collection wired; project cards for all 4 projects (screenshots captured from live/local sites).

**M3 — Case studies (Day 2–3):** Kozykook first, then Bday Site. CaseStudy layout, images, technical appendices.

**M4 — Services \+ About/Contact \+ 404 (Day 3–4):** mailto/tel links wired site-wide via the CTA component; portrait/bio/tagline placeholders in and clearly marked for Tristan's manual edit.

**M5 — Launch QA (Day 4–5):**

- Lighthouse mobile ≥95 ×4 categories  
- Real-device mobile pass (Android \+ iOS if available)  
- Every CTA click-tested (mailto opens composer with correct address; tel dials 0999-882-7004 on mobile)  
- `grep -rin "YOUR_\|<SITE_URL>\|kozykook" src/ public/` returns **zero** (content placeholders like the bio marker are *expected* to remain — they're Tristan's, not build leftovers)  
- OG preview check (Facebook Sharing Debugger — matters most for this audience)  
- Netlify site name set, HTTPS, indexed (`robots` allow), sitemap submitted to Search Console

**Dependencies:** M1 blocks all. M2/M3 parallelizable after M1. Nothing blocks M4 anymore (all inputs are placeholders or known contact info). M5 last.

**Definition of done (v1):** Home \+ Work \+ 2 full case studies \+ Services \+ About live at `<sitename>.netlify.app`, contact links verified, Lighthouse budget met. Everything else is post-launch.

---

## 9\. Post-v1 backlog (do NOT build now)

- **Custom domain** (\~₱600/yr via Cloudflare/Namecheap) — the single highest-credibility upgrade once client work justifies it; Netlify makes the switch a 5-minute DNS change \+ canonical/sitemap update  
- **Contact form** (Formspree, reusing the Kozykook pattern) if email-only proves too much friction for leads  
- Per-project OG image generation  
- Testimonials section (populate after Kozykook converts to paid — get a quote from the owner)  
- Blog / notes section (content collections make this a drop-in)  
- More commercial case studies as DDM closes clients → eventually rebalance Work page commercial-first  
- Analytics (simple, privacy-friendly — decide later)  
- Tagalog/Taglish copy variants if data warrants

## 10\. Risks & standing notes

- **Thin commercial proof at launch:** lead with Kozykook \+ process/speed messaging; personal projects carry technical depth until more client work exists.  
- **Kozykook photo rights:** portfolio screenshots of the Kozykook site are fine (it's your work product), but confirm owner sign-off before launch marketing pushes.  
- **No pricing \= qualification burden shifts to copy:** the process section must state speed expectations ("live in under a week") — it's the differentiator vs. local agencies.  
- **Free `.netlify.app` subdomain \+ public phone number:** the subdomain reads slightly less established to business owners (acceptable for a beginner portfolio; custom domain is the first backlog item), and the phone number is publicly scrapeable — accepted trade-off, revisit if spam calls start.  
- Astro is the first build-step dependency in the stack — pin the major version, commit the lockfile, and keep the site fully static so host lock-in stays zero.

