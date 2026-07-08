---
title: Vinny, at Thirty
slug: bday-site
kind: personal
featured: true
hasCaseStudy: true
clientType: Interactive birthday monograph
stack:
  - HTML
  - CSS
  - Vanilla JS
  - Netlify Functions
  - Netlify Blobs
liveUrl: https://vinny-at-thirty.netlify.app/
year: 2026
summary: A framework-free birthday site with shared letters, photo uploads, editable content, offline fallbacks, and careful accessibility details.
outcome: A personal gift built like a serious product.
cover: ../../assets/vinny-hero.jpg
---

## Problem

The project started as a birthday gift, but the product challenge was real: let guests write letters, add photos, and personalize parts of the page without requiring an account, a CMS, or a heavy app stack.

It also had to degrade gracefully. If the backend was unavailable, guests should still be able to interact with the site and avoid losing their work.

## Approach

The frontend is plain HTML, CSS, and JavaScript. Netlify Functions provide a tiny API, and Netlify Blobs stores shared letters, gallery items, and editable About content.

Each new guest submission gets its own item rather than one shared blob, so concurrent writes do not overwrite each other. The browser keeps a localStorage cache for instant loading and offline continuity, then syncs when the API is reachable.

Photos are downscaled in the browser before upload to keep storage and loading costs low. Dialogs trap focus, keyboard shortcuts work in the reader and lightbox, and motion-heavy details respect `prefers-reduced-motion`.

## Result

The site feels like a soft editorial object, but underneath it handles real shared state: letters, image uploads, edits, removals, offline fallback, and recovery from static-preview mode.

It is the strongest technical proof in this v1 portfolio because it shows the kind of judgment small business sites also need: progressive enhancement, careful data handling, security-minded rendering, and accessible interaction design.

## Technical appendix

- Netlify Blobs stores shared state behind a small serverless API.
- LocalStorage acts as a cache and offline holding area.
- Uploaded images are downscaled client-side before storage.
- User-provided text is escaped before rendering.
- Dialogs use focus management and keyboard escape paths.
- Reduced-motion settings disable decorative animation and tilt effects.
