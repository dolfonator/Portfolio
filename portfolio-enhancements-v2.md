# Portfolio Enhancements v2 — Claude Code Handoff

**Repo:** `github.com/dolfonator/Portfolio` (origin/main, currently 1 commit: `b335e82`)
**Project root:** this folder (Astro 7 static site; `src/`, `public/`, deployed on Netlify)
**Scope:** three enhancements + one critical fix. No new pages, no new dependencies.

---

## 0. CRITICAL FIX FIRST — wrong site URL

`astro.config.mjs` falls back to `https://tristan-portfolio.netlify.app` — **that URL belongs to a different person's live portfolio** (verified July 2026: a Gatsby site for "Tristan Hafer"). Every canonical URL, sitemap entry, OG URL, and JSON-LD `url` currently built from it is wrong.

**Task:** replace the fallback with the site's *actual* Netlify URL. Find it via `netlify status` / the Netlify dashboard, or ask Tristan. If it cannot be determined, fail loudly (`throw` when `SITE_URL` is unset) rather than shipping another wrong default — per project rules: no fallbacks, fail fast.

**Acceptance:** `grep -rn "tristan-portfolio" .` (excluding node_modules/dist) returns zero; built `dist/sitemap-index.xml` and canonical tags carry the real URL.

---

## 1. Navy blue theme

Replace the current forest-green/cream palette in `src/styles/tokens.css` with a navy system. All colors flow from tokens — **do not hardcode colors anywhere else**; if any component/page has hardcoded hex values, migrate them to tokens as part of this task.

Token remapping (keep token *names* semantic where they exist; rename green-specific names):

| Current token | New token | Value | Role |
|---|---|---|---|
| `--forest: #174336` | `--navy: #14304E` | primary brand; dark section bands, headings accents |
| `--forest-2: #0f2d26` | `--navy-2: #0B1F35` | deepest band / footer |
| `--moss: #6f8a55` | `--steel: #4A6FA5` | secondary accent, links on light |
| `--clay: #b76543` | `--amber: #D9822B` | CTA / highlight (warm contrast against navy) |
| `--clay-dark: #8f472f` | `--amber-dark: #A9601C` | CTA hover / text-on-light variant |
| `--gold: #c5973d` | `--gold: #C9A227` | small accents on dark bands only |
| `--paper: #fbfaf4` | `--paper: #F7F9FC` | page background (cool off-white) |
| `--paper-2: #f1efe4` | `--paper-2: #EBF0F6` | alternate light band |
| `--mist: #e4ede6` | `--mist: #DCE6F1` | tinted band |
| `--ink: #19211d` | `--ink: #16202B` | body text |
| `--ink-soft: #5f6b64` | `--ink-soft: #5A6B7E` | secondary text |
| `--line: #d9ded5` / `--line-strong: #b9c5b8` | same names | `#D5DDE7` / `#AFBDCE` | hairlines/borders |
| `--sky`, `--rose` | keep or drop | re-tint to fit (e.g. `#D8E8F4`, `#EFE0D6`) — drop if unused (grep first) |

Rules:
- **AA contrast minimum** for all text/background pairs; verify amber-on-navy and steel-on-paper especially (adjust lightness if any pair fails — the values above are starting points, not gospel).
- Update `--shadow` tint from green-ink to navy-ink rgba.
- Update `<meta name="theme-color">` in `Base.astro` and colors in `site.webmanifest` + `public/og-image.svg` to match.
- Typography, spacing, radii, layout: **unchanged**. This is a palette swap, not a redesign.

**Acceptance:** no green-era hex values remain (`grep -rin "174336\|0f2d26\|6f8a55\|b76543\|8f472f\|fbfaf4\|f1efe4\|e4ede6" src/ public/` → zero); visual pass on every page in light of the new palette; contrast checked.

---

## 2. Featured-work swap: remove Vinny, feature Bubu Workout

Home features are driven by the `featured` flag in `src/content/projects/*.md` (sorted alphabetically in `src/pages/index.astro`).

1. `bday-site.md`: set `featured: false`. **Also remove the Vinny project entirely from the site** ("remove entirely" per Tristan): delete `src/content/projects/bday-site.md`, the `/work/bday-site/` case study will disappear with it, remove `src/assets/vinny-hero.jpg`, and any references (grep `vinny\|bday` across `src/`).
2. `bubu-workout.md`: set `featured: true`, and add `hasCaseStudy: true` **only if** a case-study body is written — otherwise leave the card linking to its live demo (`/project-demos/bubu-workout/`). Writing a short case study is optional, not required for this pass.
3. Update home copy that referenced the old pairing: SectionBand 01's title/lead ("Two different reasons to trust the build… deeper technical proof") was written for Kozykook + Vinny. Rewrite for Kozykook + Bubu Workout (e.g., commercial proof + design/animation craft). Keep the same tone and length.
4. Check `Work` index page and JSON-LD/OG references for the removed project.

**Acceptance:** home shows exactly Kozykook + Bubu Workout; `grep -rin "vinny\|bday" src/ public/` → zero; build passes with no broken links (run `npx astro build` and click through `dist/` via preview).

---

## 3. UI-error audit & fixes

Tristan reports "obvious UI errors" without enumerating them. Run a systematic visual pass, fix what's clearly broken, and log each fix in the commit message. Method:

1. `npx astro dev`, inspect every page (`/`, `/work/`, `/work/kozykook/`, `/services/`, `/about/`, `/404`) at 360px, 768px, 1280px widths.
2. Known suspects to check first (from code review):
   - `public/project-demos/bubu-letters/` and `bubu-workout/` iframes/links — verify the embedded demos load with correct relative asset paths.
   - Placeholder blocks (portrait/bio/tagline) — ensure they look *intentional*, not broken (they must remain as placeholders).
   - ProjectCard image aspect ratios / cropping with the mixed screenshot set.
   - Header behavior on scroll + mobile nav toggle.
   - Footer/CTA band spacing on mobile.
   - `mailto:` / `tel:` links present and correct (tristandolfo@gmail.com / +639998827004).
3. Fix only what is objectively broken (overflow, misalignment, broken images, dead links, unreadable contrast, layout shift). Do **not** restyle working elements beyond the theme swap in Task 1 — surgical changes only.
4. Lighthouse (mobile) after fixes: all four categories ≥95, matching the original launch budget.

**Acceptance:** a short list of found-and-fixed issues in the final commit body; Lighthouse budget met; no console errors on any page.

---

## 4. Git protocol

- Work on `main` (solo repo, no branch ceremony needed).
- One commit per task, in order: `fix: correct site URL` → `feat: navy theme` → `feat: feature Bubu Workout, remove Vinny project` → `fix: UI audit fixes (list in body)`.
- `npx astro build` must pass before each commit.
- Push to `origin main` when all four are done. Netlify auto-deploys on push if the repo is connected — verify the deploy goes green; if the site is deployed by drag-and-drop instead, tell Tristan a manual redeploy of `dist/` is needed.

## Order & dependencies

Task 0 → 1 → 2 → 3 → push. 0 first because 1–3 all trigger rebuilds whose output embeds the site URL.
