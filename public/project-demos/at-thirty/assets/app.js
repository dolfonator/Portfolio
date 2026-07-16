/* ============================================================
   AT THIRTY - PUBLIC DEMO  -  interaction engine
   No frameworks. Transform/opacity motion only. localStorage-durable.
   ============================================================ */
(function () {
  "use strict";

  /* ----------------------------------------------------------
     0 · helpers
     ---------------------------------------------------------- */
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function makeId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function parsePassages(text) {
    return String(text).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  }
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (err) {
      console.error("Could not read " + key, err);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value)); // may throw (quota)  -  callers handle
  }

  // Read an image File, downscale via <canvas> to a max edge, return a JPEG data-URL.
  // Keeps localStorage small. Reused by Memory Lane and About.
  function downscaleImage(file, maxEdge, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode-failed"));
        img.onload = () => {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          const scale = Math.min(1, maxEdge / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          try { resolve(canvas.toDataURL("image/jpeg", quality)); }
          catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ----------------------------------------------------------
     0b - visitor-controlled privacy effects
     Each visitor can demonstrate the locked-letter and blurred-
     gallery states. Preferences stay in this browser and do not
     affect the original private project.
     ---------------------------------------------------------- */
  const RESTRICTION_STORE = "public-bday.preferences.v1";
  const RESTRICTIONS = Object.assign(
    { lettersLocked: false, memoriesBlurred: false },
    readJSON(RESTRICTION_STORE, {})
  );

  function applyRestrictions() {
    const locked = !!RESTRICTIONS.lettersLocked;
    const blurred = !!RESTRICTIONS.memoriesBlurred;
    document.body.classList.toggle("letters-locked", locked);
    document.body.classList.toggle("memories-blurred", blurred);

    const openBtn = $("#openBook");
    const pickBtn = $("#pickLink");
    const lockNote = $("#letterLockNote");
    const lockToggle = $("#letterLockToggle");
    const blurToggle = $("#galleryBlurToggle");
    const lockStatus = $("#letterLockStatus");
    const blurStatus = $("#galleryBlurStatus");

    if (openBtn) {
      openBtn.disabled = locked;
      const icon = openBtn.querySelector("use");
      if (icon) icon.setAttribute("href", locked ? "#i-lock" : "#i-star");
    }
    if (pickBtn) pickBtn.disabled = locked;
    if (lockNote) lockNote.hidden = !locked;
    if (lockToggle) lockToggle.checked = locked;
    if (blurToggle) blurToggle.checked = blurred;
    if (lockStatus) lockStatus.textContent = locked ? "Locked" : "Open";
    if (blurStatus) blurStatus.textContent = blurred ? "Blurred" : "Clear";
  }

  function saveRestrictions() {
    try { writeJSON(RESTRICTION_STORE, RESTRICTIONS); }
    catch (err) { console.warn("Could not save demo preferences", err); }
    applyRestrictions();
  }

  (function restrictionControls() {
    const lockToggle = $("#letterLockToggle");
    const blurToggle = $("#galleryBlurToggle");
    if (lockToggle) lockToggle.addEventListener("change", () => {
      RESTRICTIONS.lettersLocked = lockToggle.checked;
      saveRestrictions();
      if (RESTRICTIONS.lettersLocked) {
        const reader = $("#reader");
        const picker = $("#picker");
        if (reader && reader.classList.contains("is-open")) closeOverlay(reader);
        if (picker && picker.classList.contains("is-open")) closeOverlay(picker);
      }
    });
    if (blurToggle) blurToggle.addEventListener("change", () => {
      RESTRICTIONS.memoriesBlurred = blurToggle.checked;
      saveRestrictions();
    });
    applyRestrictions();
  })();

  /* ----------------------------------------------------------
     0c · BROWSER-LOCAL STORAGE BRIDGE
     The UI modules below keep one storage interface, but this
     portfolio edition never reads from or writes to a network.
     ---------------------------------------------------------- */
  const SYNC = (function () {
    const STORAGE_MODE = "browser-local";
    // Network mode is intentionally unavailable in this portfolio build.
    const API_BASE = "";

    const refreshers = [];
    let warned = false;
    let lastPull = 0;
    // per-key timestamps of local writes ("about",
    // "ov:<seedId>", "item:<id>")  -  an in-flight pull must never let a
    // stale server snapshot clobber anything written after it began
    const touched = {};
    function touch(key) { touched[key] = Date.now(); }
    function touchedAfter(key, t) { return (touched[key] || 0) > t; }

    function onRefresh(fn) { refreshers.push(fn); }
    function refreshAll() { refreshers.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

    async function req() {
      throw new Error("Network synchronization is disabled in browser-local portfolio mode.");
    }
    // fire-and-forget write. Resolves with the server's reply; with null
    // (network trouble  -  safe to retry later); or with {rejected:true}
    // when the server refused the content outright (full, too large,
    // invalid)  -  callers mark those so pulls stop retrying them.
    function push(body) {
      if (STORAGE_MODE === "browser-local") return Promise.resolve(null);
      return req({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err) => {
        console.warn("Sync push failed", err);
        if (err && err.status >= 400 && err.status < 500) {
          toast(err.serverMessage || "This browser couldn't save that change");
          return { rejected: true, error: err.serverMessage };
        }
        if (!warned) {
          warned = true;
          toast(body.op === "add"
            ? "This change stays only in this browser."
            : "This change is only on this device.");
        }
        return null;
      });
    }
    function pushSet(key, value) { touch(key); return push({ key: key, op: "set", value: value }); }
    function pushAdd(key, item) { touch("item:" + item.id); return push({ key: key, op: "add", item: item }); }
    function pushUpdate(key, id, fields) { touch("item:" + id); return push({ key: key, op: "update", id: id, fields: fields }); }
    function pushRemove(key, id) { touch("item:" + id); return push({ key: key, op: "remove", id: id }); }
    function pushOverride(id, fields) { touch("ov:" + id); return push({ key: "letterOverrides", op: "merge", id: id, fields: fields }); }

    function replaceItem(storeKey, item) {
      const arr = readJSON(storeKey, []);
      const i = arr.findIndex((x) => x && x.id === item.id);
      if (i === -1) return;
      arr[i] = item;
      try { writeJSON(storeKey, arr); } catch (e) { console.error(e); }
    }
    // After an add's push settles: fold the server's copy back in and
    // mark it synced (so a deletion on another device is honoured here),
    // or  -  if the server refused the content  -  mark it rejected so pulls
    // stop trying to republish it. Returns res for chaining.
    function markSynced(storeKey, id, res) {
      if (res && res.item) {
        replaceItem(storeKey, Object.assign({}, res.item, { synced: true }));
      } else if (res && res.rejected) {
        const arr = readJSON(storeKey, []);
        const i = arr.findIndex((x) => x && x.id === id);
        if (i !== -1) {
          arr[i] = Object.assign({}, arr[i], { rejected: true });
          try { writeJSON(storeKey, arr); } catch (e) { console.error(e); }
        }
      }
      return res;
    }

    // Server items win per id  -  EXCEPT ids touched here after this pull
    // began (edited/removed mid-flight): local state is newer than the
    // snapshot, so it stands. Items only this browser has fall in two
    // camps: never-synced ones (added before the backend existed, or
    // while offline) are kept and returned so pull() can publish them;
    // synced ones missing from the server were deleted elsewhere  -  drop.
    function mergeList(storeKey, serverArr, startedAt) {
      const local = readJSON(storeKey, []);
      const localById = {};
      local.forEach((x) => { if (x && x.id) localById[x.id] = x; });
      const seen = {};
      serverArr.forEach((x) => { if (x && x.id) seen[x.id] = true; });
      // stays local: never-synced additions, plus synced items edited
      // mid-pull whose snapshot copy is stale
      const keepLocal = local.filter((x) => x && x.id && !seen[x.id] &&
        (!x.synced || touchedAfter("item:" + x.id, startedAt)));
      // worth publishing: never-synced, not refused by the server, and
      // not already being pushed right now by its own save
      const toPublish = keepLocal.filter((x) =>
        !x.synced && !x.rejected && !touchedAfter("item:" + x.id, startedAt));
      const merged = serverArr
        .filter((x) => x && x.id &&
          (localById[x.id] || !touchedAfter("item:" + x.id, startedAt)))
        .map((x) => (touchedAfter("item:" + x.id, startedAt) && localById[x.id])
          ? localById[x.id]
          : Object.assign({}, x, { synced: true }))
        .concat(keepLocal);
      try { writeJSON(storeKey, merged); } catch (e) { console.error(e); }
      return toPublish;
    }

    function mergeDoc(storeKey, state, prop, startedAt) {
      if (touchedAfter(prop, startedAt)) return; // written here mid-pull  -  newer than the snapshot
      if (prop in state) {
        // present on the server (even as null, after a reset)  -  server wins
        try {
          if (state[prop]) writeJSON(storeKey, state[prop]);
          else localStorage.removeItem(storeKey);
        } catch (e) { console.error(e); }
        return;
      }
      const local = readJSON(storeKey, null); // never synced  -  migrate up
      if (local) pushSet(prop, local);
    }

    async function pull() {
      if (STORAGE_MODE === "browser-local") return;
      if (Date.now() - lastPull < 30000) return;
      // everything the user writes after this moment is newer than the
      // snapshot we're about to receive  -  the merge steps respect that
      const startedAt = Date.now();
      let state;
      try { state = await req(); }
      catch (err) { console.info("Browser-local mode is active.", err); return; }
      lastPull = Date.now();

      mergeDoc("public-bday.about.v1", state, "about", startedAt);

      const serverOv = state.letterOverrides || {};
      const localOv = readJSON("public-bday.letters.overrides.v1", {});
      const mergedOv = Object.assign({}, localOv);
      Object.keys(serverOv).forEach((id) => {
        if (!touchedAfter("ov:" + id, startedAt)) mergedOv[id] = serverOv[id];
      });
      try { writeJSON("public-bday.letters.overrides.v1", mergedOv); }
      catch (e) { console.error(e); }
      Object.keys(localOv).forEach((id) => {
        if (!(id in serverOv) && !touchedAfter("ov:" + id, startedAt)) pushOverride(id, localOv[id]);
      });

      const newLetters = mergeList("public-bday.letters.v1", state.letters || [], startedAt);
      const newMems = mergeList("public-bday.memories.v1", state.memories || [], startedAt);
      refreshAll();

      // publish anything this browser collected before the backend existed
      newLetters.forEach((l) => {
        pushAdd("letters", l).then((res) => markSynced("public-bday.letters.v1", l.id, res));
      });
      for (let i = 0; i < newMems.length; i++) {
        markSynced("public-bday.memories.v1", newMems[i].id, await pushAdd("memories", newMems[i]));
      }
      if (newMems.length) refreshAll();
    }

    return {
      onRefresh: onRefresh, refreshAll: refreshAll, pull: pull,
      pushSet: pushSet, pushAdd: pushAdd, pushUpdate: pushUpdate,
      pushRemove: pushRemove, pushOverride: pushOverride,
      replaceItem: replaceItem, markSynced: markSynced,
    };
  })();

  /* ----------------------------------------------------------
     1 · toast + celebration
     ---------------------------------------------------------- */
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-shown"), 2600);
  }
  function celebrate() {
    if (prefersReducedMotion) return;
    const glyphs = ["✦", "❀", "♡", "★", "✿"];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = cx + "px";
      s.style.top = cy + "px";
      s.style.color = i % 2 ? "var(--primary)" : "var(--brass)";
      s.style.setProperty("--dx", (Math.random() * 260 - 130).toFixed(0) + "px");
      s.style.setProperty("--dy", (-(Math.random() * 220 + 120)).toFixed(0) + "px");
      s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  /* ----------------------------------------------------------
     2 · overlay manager (focus-trapped, stacked)
     ---------------------------------------------------------- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const overlayStack = [];

  function topOverlay() { return overlayStack.length ? overlayStack[overlayStack.length - 1].node : null; }

  // keep any controlling toggle's aria-expanded in sync with the overlay state,
  // no matter how it's opened/closed (button, backdrop, Escape, link)
  function syncToggle(node, expanded) {
    if (!node.id) return;
    const t = document.querySelector('[aria-controls="' + node.id + '"]');
    if (t) t.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function openOverlay(node) {
    if (!node || node.classList.contains("is-open")) return;
    overlayStack.push({ node: node, lastFocused: document.activeElement });
    node.classList.add("is-open");
    document.body.classList.add("no-scroll");
    syncToggle(node, true);
    const target = node.querySelector("[data-autofocus]") || node.querySelector(FOCUSABLE);
    // wait a frame so focus lands after visibility flips
    requestAnimationFrame(() => { if (target) try { target.focus(); } catch (e) {} });
  }
  function closeOverlay(node) {
    const idx = overlayStack.map((o) => o.node).lastIndexOf(node);
    if (idx === -1) return;
    const entry = overlayStack.splice(idx, 1)[0];
    node.classList.remove("is-open");
    syncToggle(node, false);
    if (overlayStack.length === 0) document.body.classList.remove("no-scroll");
    const lf = entry.lastFocused;
    if (lf && typeof lf.focus === "function") try { lf.focus(); } catch (e) {}
  }
  function closeTop() { const t = topOverlay(); if (t) closeOverlay(t); }

  // global keys: Escape closes top; Tab is trapped within top overlay
  document.addEventListener("keydown", (e) => {
    const top = topOverlay();
    if (!top) return;
    if (e.key === "Escape") { e.preventDefault(); closeOverlay(top); return; }
    if (e.key === "Tab") {
      const items = $$(FOCUSABLE, top).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // any [data-close] closes its overlay; backdrop too
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) {
      const ov = closer.closest(".overlay");
      if (ov) closeOverlay(ov);
    }
  });

  /* ----------------------------------------------------------
     3 · navigation  -  scroll state, progress, scrollspy, mobile
     ---------------------------------------------------------- */
  const nav = $("#siteNav");
  const navToggle = $("#navToggle");
  const navSheet = $("#navSheet");

  if (nav && "IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      nav.classList.toggle("scrolled", !entries[0].isIntersecting);
    }, { rootMargin: "-72px 0px 0px", threshold: 0 });
    const heroCopy = $(".hero-copy");
    if (heroCopy) navObserver.observe(heroCopy);
  }

  // scrollspy
  const spyLinks = {};
  $$(".nav-links a[data-spy]").forEach((a) => { spyLinks[a.dataset.spy] = a; });
  const spySections = $$("#about, #memories, #letters");
  if (spySections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const link = spyLinks[en.target.id];
        if (!link) return;
        if (en.isIntersecting) {
          Object.keys(spyLinks).forEach((k) => spyLinks[k].classList.remove("active"));
          link.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    spySections.forEach((s) => spy.observe(s));
  }

  // mobile sheet
  if (navToggle && navSheet) {
    // open/close  -  the sheet's links and backdrop carry [data-close],
    // so the global handler closes it; aria-expanded stays in sync via syncToggle
    navToggle.addEventListener("click", () => {
      if (navSheet.classList.contains("is-open")) closeOverlay(navSheet);
      else openOverlay(navSheet);
    });
  }

  // scroll cue
  const scrollCue = $("#scrollCue");
  if (scrollCue) scrollCue.addEventListener("click", () => {
    const about = $("#about");
    if (about) about.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  });

  /* ----------------------------------------------------------
     4 · reveal-on-scroll
     ---------------------------------------------------------- */
  (function reveals() {
    const els = $$(".reveal");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  })();

  /* ----------------------------------------------------------
     5 · ABOUT  -  editable bio, specimen card, facts & portrait
     ---------------------------------------------------------- */
  const ABOUT = (function () {
    const STORE = "public-bday.about.v1";
    const DEFAULT = {
      portrait: "assets/public-hero.webp",
      lede: "This public portfolio edition keeps the original birthday monograph experience while replacing every private detail.",
      paragraphs: [
        "The original site was designed as a personal thirtieth-birthday keepsake, bringing a life story, photographs, and letters into one quiet interactive experience. This edition preserves that structure without exposing the person it was made for.",
        "Generated still lifes and fictional notes stand in for the private material. Visitors can edit the demo to explore the interaction design, with every change stored only in their own browser.",
      ],
      specimen: [["Edition", "Public portfolio"], ["Occasion", "30th birthday"], ["Format", "Browser-local demo"], ["Content", "Placeholder only"], ["Privacy", "Personal details removed"]],
      tags: ["thirty", "birthday", "keepsake", "privacy-safe"],
      facts: [
        ["30", "Three Decades", "Placeholder highlight copy for a milestone birthday celebrated across the original experience."],
        ["09", "Gallery Moments", "Nine generated still lifes replace every photograph from the private Memory Lane collection."],
        ["03", "Sample Letters", "Three placeholder notes preserve the reader while local additions demonstrate the editing flow."],
      ],
    };
    function load() {
      const v = readJSON(STORE, null);
      if (!v || typeof v !== "object" || Array.isArray(v)) return JSON.parse(JSON.stringify(DEFAULT));
      return {
        portrait: typeof v.portrait === "string" && v.portrait ? v.portrait : DEFAULT.portrait,
        lede: typeof v.lede === "string" ? v.lede : DEFAULT.lede,
        paragraphs: Array.isArray(v.paragraphs) && v.paragraphs.length ? v.paragraphs : DEFAULT.paragraphs,
        specimen: Array.isArray(v.specimen) ? v.specimen : DEFAULT.specimen,
        tags: Array.isArray(v.tags) ? v.tags : DEFAULT.tags,
        facts: Array.isArray(v.facts) ? v.facts : DEFAULT.facts,
      };
    }
    function save(data) { writeJSON(STORE, data); SYNC.pushSet("about", data); }
    function reset() {
      try { localStorage.removeItem(STORE); } catch (e) {}
      SYNC.pushSet("about", null);
    }
    return { DEFAULT: DEFAULT, load: load, save: save, reset: reset };
  })();

  (function aboutUI() {
    const portraitEl = $("#aboutPortrait");
    const ledeEl = $("#aboutLede");
    const parasEl = $("#aboutParas");
    const specList = $("#specimenList");
    const tagsEl = $("#specimenTags");
    const factsEl = $("#aboutFacts");
    const editBtn = $("#aboutEditBtn");

    const overlay = $("#aboutOverlay");
    const form = $("#aboutForm");
    const errEl = $("#aboutError");
    const drop = $("#aboutDrop");
    const fileInput = $("#aboutFile");
    const dropPrompt = $("#aboutDropPrompt");
    const preview = $("#aboutPreview");
    const aLede = $("#aLede");
    const aBody = $("#aBody");
    const specFields = $("#aboutSpecFields");
    const aTags = $("#aTags");
    const factFields = $("#aboutFactFields");
    const resetBtn = $("#aboutReset");

    if (!factsEl) return;
    let pendingPortrait = null;

    function render() {
      const d = ABOUT.load();
      if (portraitEl) { portraitEl.src = d.portrait; portraitEl.alt = "Privacy-safe generated birthday still life."; }
      if (ledeEl) ledeEl.textContent = d.lede;
      if (parasEl) parasEl.innerHTML = d.paragraphs.map((p) => "<p>" + escapeHTML(p) + "</p>").join("");
      if (specList) specList.innerHTML = d.specimen
        .filter((r) => r && (r[0] || r[1]))
        .map((r) => "<dt>" + escapeHTML(r[0] || "") + "</dt><dd>" + escapeHTML(r[1] || "") + "</dd>").join("");
      if (tagsEl) tagsEl.innerHTML = d.tags.filter(Boolean).map((t) => '<li class="tag-pill">' + escapeHTML(t) + "</li>").join("");
      if (factsEl) factsEl.innerHTML = d.facts.filter((f) => f && (f[1] || f[2])).map((f) =>
        '<li class="principle"><span class="principle__mark">' + escapeHTML(f[0] || "") + "</span>" +
        '<div class="principle__title">' + escapeHTML(f[1] || "") + "</div>" +
        '<p class="principle__body">' + escapeHTML(f[2] || "") + "</p></li>").join("");
    }

    function showErr(m) { errEl.textContent = m; errEl.classList.add("is-shown"); }
    function clearErr() { errEl.textContent = ""; errEl.classList.remove("is-shown"); }

    function buildForm(d) {
      pendingPortrait = d.portrait;
      preview.src = d.portrait; preview.hidden = false; dropPrompt.style.display = "none";
      aLede.value = d.lede;
      aBody.value = d.paragraphs.join("\n\n");
      aTags.value = d.tags.join(", ");
      const spec = d.specimen.slice(0, 6);
      while (spec.length < 5) spec.push(["", ""]);
      specFields.innerHTML = spec.map((r, i) =>
        '<input type="text" data-spec-label="' + i + '" value="' + escapeHTML(r[0] || "") + '" placeholder="Label" aria-label="Detail ' + (i + 1) + ' label" autocomplete="off" />' +
        '<input type="text" data-spec-value="' + i + '" value="' + escapeHTML(r[1] || "") + '" placeholder="Value" aria-label="Detail ' + (i + 1) + ' value" autocomplete="off" />'
      ).join("");
      const facts = d.facts.slice(0, 3);
      while (facts.length < 3) facts.push(["", "", ""]);
      factFields.innerHTML = facts.map((f, i) =>
        '<div class="fact-edit">' +
          '<input type="text" data-fact-title="' + i + '" value="' + escapeHTML(f[1] || "") + '" placeholder="Headline" aria-label="Highlight ' + (i + 1) + ' headline" autocomplete="off" />' +
          '<textarea data-fact-body="' + i + '" placeholder="A sentence or two" aria-label="Highlight ' + (i + 1) + ' text">' + escapeHTML(f[2] || "") + "</textarea>" +
        "</div>"
      ).join("");
    }

    function openEdit() { clearErr(); buildForm(ABOUT.load()); openOverlay(overlay); }

    function collect() {
      const specimen = [];
      $$('[data-spec-label]', specFields).forEach((lab) => {
        const i = lab.dataset.specLabel;
        const valEl = specFields.querySelector('[data-spec-value="' + i + '"]');
        const L = lab.value.trim(), V = valEl ? valEl.value.trim() : "";
        if (L || V) specimen.push([L, V]);
      });
      const facts = [];
      $$('[data-fact-title]', factFields).forEach((t) => {
        const i = t.dataset.factTitle;
        const bEl = factFields.querySelector('[data-fact-body="' + i + '"]');
        const title = t.value.trim(), body = bEl ? bEl.value.trim() : "";
        if (title || body) facts.push([("0" + (facts.length + 1)).slice(-2), title, body]);
      });
      const tags = aTags.value.split(",").map((s) => s.trim()).filter(Boolean);
      const paragraphs = parsePassages(aBody.value);
      return {
        portrait: pendingPortrait || ABOUT.DEFAULT.portrait,
        lede: aLede.value.trim() || ABOUT.DEFAULT.lede,
        paragraphs: paragraphs.length ? paragraphs : ABOUT.DEFAULT.paragraphs.slice(),
        specimen: specimen.length ? specimen : ABOUT.DEFAULT.specimen.slice(),
        tags: tags,
        facts: facts.length ? facts : ABOUT.DEFAULT.facts.slice(),
      };
    }

    async function onPortraitFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) { showErr("That doesn't look like an image file."); return; }
      clearErr();
      try {
        pendingPortrait = await downscaleImage(file, 1000, 0.82);
        preview.src = pendingPortrait; preview.hidden = false; dropPrompt.style.display = "none";
      } catch (e) { console.error(e); showErr("Couldn't read that image. Try another one."); }
    }

    function onSubmit(e) {
      e.preventDefault();
      const data = collect();
      try { ABOUT.save(data); }
      catch (err) { console.error(err); showErr("Storage is full. try a smaller portrait, or remove a few photos from Memory Lane."); return; }
      render();
      closeOverlay(overlay);
      toast("About updated ♡");
      celebrate();
    }

    function onReset() {
      if (!window.confirm("Reset the About section to its original words and photo?")) return;
      ABOUT.reset();
      render();
      buildForm(ABOUT.load());
      toast("Reset to default");
    }

    if (editBtn) editBtn.addEventListener("click", openEdit);
    if (form) form.addEventListener("submit", onSubmit);
    if (resetBtn) resetBtn.addEventListener("click", onReset);
    if (fileInput) fileInput.addEventListener("change", (e) => onPortraitFile(e.target.files && e.target.files[0]));
    if (drop) {
      ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-drag"); }));
      ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-drag"); }));
      drop.addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) onPortraitFile(f); });
    }

    render();
    SYNC.onRefresh(render);
  })();

  /* ----------------------------------------------------------
     6 · LETTERS
     ---------------------------------------------------------- */
  const LETTERS = (function () {
    const STORE = "public-bday.letters.v1";
    const OVERRIDES = "public-bday.letters.overrides.v1";

    // Seed letters are hard-coded so they can never be lost. Personalise freely.
    const SEED = [
      {
        id: "seed-letter-1", seed: true,
        title: "Placeholder Letter One", date: "For a 30th birthday", from: "Placeholder sign-off",
        passages: [
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec feugiat, ligula vitae posuere tempor, justo erat luctus neque, sed feugiat ipsum lorem vel nunc.",
          "Aliquam erat volutpat. Mauris viverra, velit at aliquet posuere, augue sem consequat lectus, et volutpat risus lorem in justo.",
        ],
      },
      {
        id: "seed-letter-2", seed: true,
        title: "Placeholder Letter Two", date: "A sample birthday note", from: "Placeholder sign-off",
        passages: [
          "Praesent commodo justo sed nibh cursus, quis interdum ligula consequat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.",
          "Suspendisse potenti. Nulla facilisi. Cras vitae lorem vel augue aliquet posuere sit amet at neque.",
        ],
      },
      {
        id: "seed-letter-3", seed: true,
        title: "Placeholder Letter Three", date: "Public portfolio edition", from: "Placeholder sign-off",
        passages: [
          "Fusce interdum, ipsum vitae sollicitudin tristique, lectus magna volutpat turpis, non bibendum augue tortor sed erat.",
          "Nunc placerat sem vel lorem luctus, at consequat purus feugiat. This sample closes the reader without revealing any original message.",
        ],
      },
    ];

    function loadAdded() {
      const v = readJSON(STORE, []);
      return Array.isArray(v) ? v : [];
    }
    function saveAdded(arr) { writeJSON(STORE, arr); }
    function loadOverrides() {
      const v = readJSON(OVERRIDES, {});
      return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    }
    function saveOverrides(map) { writeJSON(OVERRIDES, map); }
    function isSeed(id) { return SEED.some((l) => l.id === id); }

    function all() {
      const ov = loadOverrides();
      const seeds = SEED.map((l) => (ov[l.id] ? Object.assign({}, l, ov[l.id]) : l));
      return seeds.concat(loadAdded());
    }
    function saveEdit(id, fields) {
      if (isSeed(id)) {
        const ov = loadOverrides();
        ov[id] = { title: fields.title, from: fields.from, date: fields.date, passages: fields.passages };
        saveOverrides(ov);
        SYNC.pushOverride(id, ov[id]);
      } else {
        const added = loadAdded();
        const i = added.findIndex((l) => l.id === id);
        if (i === -1) throw new Error("Letter not found: " + id);
        added[i] = Object.assign({}, added[i], fields);
        saveAdded(added);
        SYNC.pushUpdate("letters", id, fields);
      }
    }
    function add(fields) {
      const added = loadAdded();
      const item = Object.assign({ id: makeId(), seed: false }, fields);
      added.push(item);
      saveAdded(added);
      SYNC.pushAdd("letters", item).then((res) => SYNC.markSynced(STORE, item.id, res));
    }
    function remove(id) {
      saveAdded(loadAdded().filter((l) => l.id !== id));
      SYNC.pushRemove("letters", id);
    }
    function find(id) {
      const l = all().find((x) => x.id === id);
      if (!l) throw new Error("Letter not found: " + id);
      return l;
    }
    return { all, saveEdit, add, remove, find, isSeed, loadAdded };
  })();

  (function lettersUI() {
    const countEl = $("#letterCount");
    const openBtn = $("#openBook");
    const pickLink = $("#pickLink");
    const addLink = $("#addLink");

    // reader nodes
    const reader = $("#reader");
    const page = $("#page");
    const sheet = reader && reader.querySelector(".letter-sheet");
    const rTitle = $("#readerTitle");
    const rDate = $("#readerDate");
    const rBody = $("#readerBody");
    const rSign = $("#readerSign");
    const prevBtn = $("#prevBtn");
    const nextBtn = $("#nextBtn");
    const bookCount = $("#bookCount");

    // picker
    const picker = $("#picker");
    const pickerList = $("#pickerList");

    // form
    const addOverlay = $("#addOverlay");
    const addForm = $("#addForm");
    const fTitle = $("#fTitle");
    const fFrom = $("#fFrom");
    const fDate = $("#fDate");
    const fBody = $("#fBody");
    const formError = $("#formError");
    const formHead = $("#addTitle");
    const formIntro = $("#formIntro");
    const formSubmit = $("#formSubmit");
    const manageWrap = $("#manageWrap");
    const manageList = $("#manageList");

    let bag = [], history = [], pos = -1, lastDrawn = null, isTurning = false;
    let editingId = null;

    function updateCount() {
      if (!countEl) return;
      const n = LETTERS.all().length;
      countEl.textContent = n + (n === 1 ? " letter, waiting for you" : " letters, waiting for you");
    }

    /* shuffle bag */
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    function drawNextId() {
      if (bag.length === 0) {
        bag = shuffle(LETTERS.all().map((l) => l.id));
        if (bag.length > 1 && bag[0] === lastDrawn) { const t = bag[0]; bag[0] = bag[1]; bag[1] = t; }
      }
      const id = bag.shift();
      lastDrawn = id;
      return id;
    }

    function renderLetter(l) {
      const hasTitle = !!(l.title && l.title.trim());
      rTitle.textContent = hasTitle ? l.title : "an untitled letter";
      rTitle.classList.toggle("is-empty", !hasTitle);
      rDate.textContent = l.date || "";
      rDate.style.display = l.date ? "" : "none";
      rBody.innerHTML = (l.passages || []).map((p) => "<p>" + escapeHTML(p) + "</p>").join("");
      if (rSign) {
        if (l.from && l.from.trim()) {
          rSign.innerHTML = " -  <span>" + escapeHTML(l.from) + "</span>";
          rSign.style.display = "";
        } else { rSign.textContent = ""; rSign.style.display = "none"; }
      }
      if (sheet) sheet.scrollTop = 0;
    }
    function updateNav() {
      prevBtn.disabled = pos <= 0;
      const total = LETTERS.all().length;
      bookCount.textContent = "✦ " + ((pos % total) + 1) + " of " + total;
    }

    // Play one WAAPI keyframe set and resolve when it's done  -  with an
    // onfinish hook AND a hard timeout fallback, so a flaky/never-resolving
    // .finished promise can never hang the reader.
    function animateOnce(el, frames, opts) {
      return new Promise((resolve) => {
        let settled = false;
        const done = () => { if (settled) return; settled = true; resolve(); };
        let anim;
        try { anim = el.animate(frames, opts); }
        catch (e) { done(); return; }
        if (anim) {
          anim.onfinish = done;
          anim.oncancel = done;
          if (anim.finished && anim.finished.then) anim.finished.then(done, done);
        }
        setTimeout(done, (opts.duration || 300) + 90);
      });
    }

    async function turnPage(dir, render) {
      isTurning = true;
      if (prefersReducedMotion || typeof page.animate !== "function") { render(); isTurning = false; return; }
      const outTo = dir === "prev" ? "translateX(60%) rotateY(14deg) scale(.96)" : "translateX(-60%) rotateY(-14deg) scale(.96)";
      const inFrom = dir === "prev" ? "translateX(-60%) rotateY(-14deg) scale(.96)" : "translateX(60%) rotateY(14deg) scale(.96)";
      try {
        await animateOnce(page, [{ transform: "none", opacity: 1 }, { transform: outTo, opacity: 0 }],
          { duration: 280, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
        render();
        await animateOnce(page, [{ transform: inFrom, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
      } catch (e) {
        console.error("page-turn", e);
        render();
      } finally {
        // never leave the page stuck on a forwards-fill: drop animations, restore natural state
        if (page.getAnimations) page.getAnimations().forEach((a) => a.cancel());
        page.style.transform = "none";
        page.style.opacity = "1";
        requestAnimationFrame(() => { page.style.transform = ""; page.style.opacity = ""; });
        isTurning = false;
      }
    }

    function showCurrent(dir) {
      let l;
      try { l = LETTERS.find(history[pos]); }
      catch (e) {
        // a letter vanished mid-session (removed on another device while
        // the reader was open)  -  heal the trail instead of freezing
        const live = {};
        LETTERS.all().forEach((x) => { live[x.id] = true; });
        history = history.filter((id) => live[id]);
        bag = bag.filter((id) => live[id]);
        if (pos > history.length - 1) pos = history.length - 1;
        if (pos < 0) { history = [drawNextId()]; pos = 0; }
        l = LETTERS.find(history[pos]);
      }
      updateNav();
      turnPage(dir, () => renderLetter(l));
    }
    function beginReading(firstId) {
      bag = shuffle(LETTERS.all().map((l) => l.id).filter((id) => id !== firstId));
      lastDrawn = firstId; history = [firstId]; pos = 0;
      renderLetter(LETTERS.find(firstId)); updateNav();
      openOverlay(reader);
    }
    function startReading() {
      const ids = LETTERS.all().map((l) => l.id);
      if (!ids.length) return;
      beginReading(shuffle(ids)[0]);
    }
    function goNext() {
      if (isTurning) return;
      if (pos < history.length - 1) pos++;
      else { history.push(drawNextId()); pos = history.length - 1; }
      showCurrent("next");
    }
    function goPrev() {
      if (isTurning || pos <= 0) return;
      pos--; showCurrent("prev");
    }

    /* picker */
    function renderPicker() {
      pickerList.innerHTML = LETTERS.all().map((l, i) => {
        const hasTitle = !!(l.title && l.title.trim());
        const label = hasTitle ? escapeHTML(l.title) : "Letter " + (i + 1);
        const cls = hasTitle ? "picker__name" : "picker__name picker__name--untitled";
        return '<li class="picker__row">' +
          '<button class="picker__item" type="button" data-pick="' + l.id + '">' +
            '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"/></svg>' +
            '<span class="' + cls + '">' + label + "</span></button>" +
          '<button class="picker__edit" type="button" data-edit="' + l.id + '" aria-label="Edit this letter">' +
            '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-edit"/></svg></button>' +
          "</li>";
      }).join("");
    }
    function openPicker() { renderPicker(); openOverlay(picker); }

    /* form */
    function showFormError(m) { formError.textContent = m; formError.classList.add("is-shown"); }
    function clearFormError() { formError.textContent = ""; formError.classList.remove("is-shown"); }

    function renderManage() {
      const added = LETTERS.loadAdded();
      if (!added.length) { manageWrap.hidden = true; manageList.innerHTML = ""; return; }
      manageWrap.hidden = false;
      manageList.innerHTML = added.map((l) => {
        const name = l.title ? l.title : (l.passages && l.passages[0]) || "Untitled";
        return '<li class="manage__item"><span class="manage__name">' + escapeHTML(name) + "</span>" +
          '<button class="manage__del" type="button" data-delete="' + l.id + '" aria-label="Remove this letter">' +
          '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg></button></li>';
      }).join("");
    }
    function openAdd() {
      editingId = null; addForm.reset(); clearFormError();
      formHead.textContent = "Write a new letter";
      formIntro.textContent = "This note stays in this browser. Use placeholder text and omit names or private details.";
      formSubmit.textContent = "Add this letter";
      renderManage();
      openOverlay(addOverlay);
    }
    function openEdit(id) {
      const l = LETTERS.find(id); editingId = id; clearFormError();
      fTitle.value = l.title || ""; fFrom.value = l.from || ""; fDate.value = l.date || "";
      fBody.value = (l.passages || []).join("\n\n");
      formHead.textContent = "Edit letter";
      formIntro.textContent = "Changes stay in this browser. Keep the text fictional or privacy-safe.";
      formSubmit.textContent = "Save changes";
      manageWrap.hidden = true;
      openOverlay(addOverlay);
    }
    function onSubmit(e) {
      e.preventDefault();
      const title = fTitle.value.trim();
      const bodyRaw = fBody.value.trim();
      if (!bodyRaw) { showFormError("Write a little something first ♡"); fBody.focus(); return; }
      const passages = parsePassages(bodyRaw);
      if (!passages.length) { showFormError("Write a little something first ♡"); fBody.focus(); return; }
      const fields = { title: title, from: fFrom.value.trim(), date: fDate.value.trim(), passages: passages };
      try {
        if (editingId) LETTERS.saveEdit(editingId, fields);
        else LETTERS.add(fields);
      } catch (err) {
        console.error(err);
        showFormError("Couldn't save this. Open the page as a normal browser tab (or put it online) so it can remember changes.");
        return;
      }
      updateCount();
      if (editingId) {
        editingId = null; closeOverlay(addOverlay); openPicker(); toast("Saved ♡");
      } else {
        addForm.reset(); renderManage(); fTitle.focus(); toast("Letter added ♡");
      }
      celebrate();
    }
    function requestDelete(id) {
      if (!window.confirm("Remove this letter from this browser? This can't be undone.")) return;
      LETTERS.remove(id); updateCount(); renderManage();
    }

    /* wiring */
    if (openBtn) openBtn.addEventListener("click", startReading);
    if (nextBtn) nextBtn.addEventListener("click", goNext);
    if (prevBtn) prevBtn.addEventListener("click", goPrev);
    if (pickLink) pickLink.addEventListener("click", openPicker);
    if (addLink) addLink.addEventListener("click", openAdd);

    if (pickerList) pickerList.addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit]");
      if (edit) { closeOverlay(picker); openEdit(edit.dataset.edit); return; }
      const pick = e.target.closest("[data-pick]");
      if (pick) { closeOverlay(picker); beginReading(pick.dataset.pick); }
    });
    if (manageList) manageList.addEventListener("click", (e) => {
      const del = e.target.closest("[data-delete]");
      if (del) requestDelete(del.dataset.delete);
    });
    if (addForm) addForm.addEventListener("submit", onSubmit);

    // arrow keys turn pages while the reader is the top overlay
    document.addEventListener("keydown", (e) => {
      if (topOverlay() !== reader) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    });

    updateCount();
    SYNC.onRefresh(updateCount);
  })();

  /* ----------------------------------------------------------
     7 · MEMORY LANE
     ---------------------------------------------------------- */
  const MEM = (function () {
    const STORE = "public-bday.memories.v1";
    // Nine generated, person-free placeholders are baked in and cannot be deleted.
    const SEED = [
      { id: "seed-mem-1", seed: true, src: "assets/gallery-01.webp", caption: "Placeholder memory 01", date: "Privacy-safe placeholder", alt: "Generated ribbon and confetti still life." },
      { id: "seed-mem-2", seed: true, src: "assets/gallery-02.webp", caption: "Placeholder memory 02", date: "Privacy-safe placeholder", alt: "Generated blank gift boxes with ribbon." },
      { id: "seed-mem-3", seed: true, src: "assets/gallery-03.webp", caption: "Placeholder memory 03", date: "Privacy-safe placeholder", alt: "Generated translucent birthday balloons." },
      { id: "seed-mem-4", seed: true, src: "assets/gallery-04.webp", caption: "Placeholder memory 04", date: "Privacy-safe placeholder", alt: "Generated birthday cake and candles." },
      { id: "seed-mem-5", seed: true, src: "assets/gallery-05.webp", caption: "Placeholder memory 05", date: "Privacy-safe placeholder", alt: "Generated flower bouquet with blank wrapping." },
      { id: "seed-mem-6", seed: true, src: "assets/gallery-06.webp", caption: "Placeholder memory 06", date: "Privacy-safe placeholder", alt: "Generated instant camera and blank photo cards." },
      { id: "seed-mem-7", seed: true, src: "assets/gallery-07.webp", caption: "Placeholder memory 07", date: "Privacy-safe placeholder", alt: "Generated paper party hats and ribbon." },
      { id: "seed-mem-8", seed: true, src: "assets/gallery-08.webp", caption: "Placeholder memory 08", date: "Privacy-safe placeholder", alt: "Generated celebratory drink and blank place card." },
      { id: "seed-mem-9", seed: true, src: "assets/gallery-09.webp", caption: "Placeholder memory 09", date: "Privacy-safe placeholder", alt: "Generated open blank scrapbook with paper details." },
    ];
    function loadAdded() { const v = readJSON(STORE, []); return Array.isArray(v) ? v : []; }
    function saveAdded(a) { writeJSON(STORE, a); }
    function all() { return SEED.concat(loadAdded()); }
    // Retain the local item after a storage write and refresh if its
    // image source changes.
    function afterSync(id, res) {
      const r = SYNC.markSynced(STORE, id, res);
      if (r && r.item && r.item.src) {
        const pre = new Image();
        pre.onload = pre.onerror = () => SYNC.refreshAll();
        pre.src = r.item.src;
      }
    }
    function add(m) {
      const a = loadAdded(); a.push(m); saveAdded(a);
      SYNC.pushAdd("memories", m).then((res) => afterSync(m.id, res));
    }
    function remove(id) {
      saveAdded(loadAdded().filter((m) => m.id !== id));
      SYNC.pushRemove("memories", id);
    }
    function update(id, fields) {
      const a = loadAdded(); const i = a.findIndex((m) => m.id === id);
      if (i === -1) return; a[i] = Object.assign({}, a[i], fields); saveAdded(a);
      SYNC.pushUpdate("memories", id, fields).then((res) => afterSync(id, res));
    }
    function isSeed(id) { return SEED.some((m) => m.id === id); }
    return { all, add, remove, update, isSeed, loadAdded };
  })();

  (function memoryUI() {
    const gallery = $("#gallery");
    if (!gallery) return;

    const memOverlay = $("#memOverlay");
    const memForm = $("#memForm");
    const memFile = $("#memFile");
    const dropzone = $("#dropzone");
    const dropPrompt = $("#dropPrompt");
    const dropPreview = $("#dropPreview");
    const memCaption = $("#memCaption");
    const memDate = $("#memDate");
    const memError = $("#memError");
    const memManageWrap = $("#memManageWrap");
    const memManageList = $("#memManageList");

    const lightbox = $("#lightbox");
    const lbImg = $("#lbImg");
    const lbCaption = $("#lbCaption");
    const lbCount = $("#lbCount");
    const lbPrev = $("#lbPrev");
    const lbNext = $("#lbNext");

    let pendingDataURL = null;
    let lbIndex = 0;

    /* render gallery */
    function render() {
      const items = MEM.all();
      const plates = items.map((m, i) => {
        const cap = m.caption ? escapeHTML(m.caption) : "";
        const date = m.date ? '<span class="plate__date">' + escapeHTML(m.date) + "</span>" : "";
        const capHTML = (cap || date) ? '<figcaption class="plate__cap">' + cap + date + "</figcaption>" : "";
        const tools = MEM.isSeed(m.id) ? "" :
          '<div class="plate__tools">' +
            '<button class="plate__tool plate__tool--edit" type="button" data-mem-edit="' + m.id + '" aria-label="Edit caption">' +
              '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-edit"/></svg></button>' +
            '<button class="plate__tool plate__tool--del" type="button" data-mem-del="' + m.id + '" aria-label="Remove photo">' +
              '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg></button>' +
          "</div>";
        const alt = escapeHTML(m.alt || m.caption || "Browser-local demo gallery image");
        return '<figure class="plate">' + tools +
          '<button class="plate__btn" type="button" data-mem-open="' + i + '" aria-label="View photo: ' + alt + '">' +
            '<img class="plate__img" src="' + escapeHTML(m.src) + '" alt="' + alt + '" loading="lazy" decoding="async" />' +
          "</button>" + capHTML + "</figure>";
      }).join("");
      const tile = '<button class="add-tile" type="button" id="addMemTile">' +
        '<span class="add-tile__plus"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-plus"/></svg></span>' +
        '<span class="add-tile__label">Hang a photo</span>' +
        '<span class="add-tile__hint">add a moment to the wall</span></button>';
      gallery.innerHTML = plates + tile;
    }

    function showMemError(m) { memError.textContent = m; memError.classList.add("is-shown"); }
    function clearMemError() { memError.textContent = ""; memError.classList.remove("is-shown"); }

    function resetForm() {
      memForm.reset(); pendingDataURL = null; clearMemError();
      dropPreview.hidden = true; dropPreview.removeAttribute("src");
      dropPrompt.style.display = "";
      memSubmit && (memSubmit.textContent = "Add to the wall");
      editingMemId = null;
    }
    const memSubmit = $("#memSubmit");
    let editingMemId = null;

    function renderMemManage() {
      const added = MEM.loadAdded();
      if (!added.length) { memManageWrap.hidden = true; memManageList.innerHTML = ""; return; }
      memManageWrap.hidden = false;
      memManageList.innerHTML = added.map((m) =>
        '<li class="manage__item"><span class="manage__name">' + escapeHTML(m.caption || "Untitled photo") + "</span>" +
        '<button class="manage__del" type="button" data-memmanage-del="' + m.id + '" aria-label="Remove photo">' +
        '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-trash"/></svg></button></li>').join("");
    }

    function openAddMemory() {
      resetForm();
      $("#memFormTitle").textContent = "Hang a photo";
      renderMemManage();
      openOverlay(memOverlay);
    }
    function openEditMemory(id) {
      const m = MEM.all().find((x) => x.id === id);
      if (!m) return;
      resetForm();
      editingMemId = id;
      pendingDataURL = m.src; // keep existing image unless replaced
      dropPreview.src = m.src; dropPreview.hidden = false; dropPrompt.style.display = "none";
      memCaption.value = m.caption || ""; memDate.value = m.date || "";
      $("#memFormTitle").textContent = "Edit photo";
      memSubmit.textContent = "Save changes";
      memManageWrap.hidden = true;
      openOverlay(memOverlay);
    }

    async function handleFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type)) { showMemError("That doesn't look like an image file."); return; }
      clearMemError();
      try {
        pendingDataURL = await downscaleImage(file, 1400, 0.82);
        dropPreview.src = pendingDataURL; dropPreview.hidden = false;
        dropPrompt.style.display = "none";
      } catch (e) {
        console.error(e); showMemError("Couldn't read that image. Try another one.");
      }
    }

    async function onMemSubmit(e) {
      e.preventDefault();
      if (!pendingDataURL) { showMemError("Choose a photo first."); return; }
      const fields = { caption: memCaption.value.trim(), date: memDate.value.trim() };
      try {
        if (editingMemId) {
          MEM.update(editingMemId, Object.assign({ src: pendingDataURL }, fields));
        } else {
          MEM.add(Object.assign({ id: makeId(), seed: false, src: pendingDataURL, alt: fields.caption }, fields));
        }
      } catch (err) {
        console.error(err);
        showMemError("Storage is full. this browser can't keep more photos. Remove a few and try again.");
        return;
      }
      render();
      if (editingMemId) { closeOverlay(memOverlay); toast("Photo updated ♡"); }
      else { resetForm(); renderMemManage(); toast("Memory added ♡"); }
      celebrate();
    }

    /* lightbox */
    function openLightbox(index) {
      lbIndex = index; renderLightbox(); openOverlay(lightbox);
    }
    function renderLightbox() {
      const items = MEM.all();
      if (!items.length) return;
      lbIndex = (lbIndex + items.length) % items.length;
      const m = items[lbIndex];
      lbImg.src = m.src;
      lbImg.alt = m.alt || m.caption || "Browser-local demo gallery image";
      lbCaption.textContent = m.caption || "";
      lbCount.textContent = "✦ " + (lbIndex + 1) + " of " + items.length;
      const many = items.length > 1;
      lbPrev.style.display = many ? "" : "none";
      lbNext.style.display = many ? "" : "none";
    }
    function lbStep(d) { lbIndex += d; renderLightbox(); }

    /* wiring */
    gallery.addEventListener("click", (e) => {
      const open = e.target.closest("[data-mem-open]");
      if (open) { openLightbox(parseInt(open.dataset.memOpen, 10)); return; }
      const edit = e.target.closest("[data-mem-edit]");
      if (edit) { openEditMemory(edit.dataset.memEdit); return; }
      const del = e.target.closest("[data-mem-del]");
      if (del) { if (window.confirm("Remove this photo from this browser?")) { MEM.remove(del.dataset.memDel); render(); } return; }
      if (e.target.closest("#addMemTile")) openAddMemory();
    });

    if (memFile) memFile.addEventListener("change", (e) => handleFile(e.target.files && e.target.files[0]));
    if (dropzone) {
      ["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("is-drag"); }));
      ["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("is-drag"); }));
      dropzone.addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    }
    if (memForm) memForm.addEventListener("submit", onMemSubmit);
    if (memManageList) memManageList.addEventListener("click", (e) => {
      const del = e.target.closest("[data-memmanage-del]");
      if (del && window.confirm("Remove this photo from this browser?")) { MEM.remove(del.dataset.memmanageDel); render(); renderMemManage(); }
    });

    if (lbPrev) lbPrev.addEventListener("click", () => lbStep(-1));
    if (lbNext) lbNext.addEventListener("click", () => lbStep(1));
    document.addEventListener("keydown", (e) => {
      if (topOverlay() !== lightbox) return;
      if (e.key === "ArrowRight") { e.preventDefault(); lbStep(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); lbStep(-1); }
    });

    render();
    SYNC.onRefresh(render);
  })();

  /* ----------------------------------------------------------
     8 · hero portrait pointer-tilt (desktop, motion-on only)
     ---------------------------------------------------------- */
  (function heroTilt() {
    const frame = $("#heroFrame");
    if (!frame || prefersReducedMotion || isTouch) return;
    const fig = frame.closest(".hero-figure");
    let raf = null;
    function move(e) {
      const r = fig.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        frame.style.transform = "rotate(" + (dx * 1.4).toFixed(2) + "deg) translate(" +
          (dx * 5).toFixed(1) + "px," + (dy * 5).toFixed(1) + "px)";
        raf = null;
      });
    }
    function reset() { if (raf) cancelAnimationFrame(raf), raf = null; frame.style.transform = ""; }
    fig.addEventListener("mousemove", move);
    fig.addEventListener("mouseleave", reset);
  })();

  /* ----------------------------------------------------------
     9 · drifting petals (decorative, capped, motion-on only)
     ---------------------------------------------------------- */
  (function petals() {
    const sky = $("#petals");
    if (!sky || prefersReducedMotion) return;
    const count = window.innerWidth < 760 ? 0 : 12;
    if (!count) return;
    const colors = ["var(--primary)", "var(--blush-ring)", "var(--brass-soft)"];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      const size = (Math.random() * 8 + 7).toFixed(0);
      p.style.width = p.style.height = size + "px";
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.background = colors[i % colors.length];
      p.style.opacity = (Math.random() * 0.25 + 0.15).toFixed(2);
      p.style.setProperty("--drift", (Math.random() * 120 - 60).toFixed(0) + "px");
      const dur = (Math.random() * 10 + 12).toFixed(1);
      p.style.animationDuration = dur + "s";
      p.style.animationDelay = (-Math.random() * parseFloat(dur)).toFixed(1) + "s";
      frag.appendChild(p);
    }
    sky.appendChild(frag);
  })();

  /* ----------------------------------------------------------
     10 · browser-local boot
     The storage interface remains active for UI refreshes, while
     pull() exits immediately without making a network request.
     ---------------------------------------------------------- */
  SYNC.pull();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !overlayStack.length) SYNC.pull();
  });

})();
