/* =================================================================
   JUSTDIZ PREPRODUCTIONS — interactivity (vanilla JS, no dependencies)
   - mobile nav toggle + smart close
   - scroll-reveal (IntersectionObserver) — light fade-up only
   - active-section highlight in nav
   - today's-hours highlight
   - current year in footer
   Scrolling is native (crisp): smooth anchors via CSS scroll-behavior.
   ================================================================= */
(function () {
  "use strict";

  /* ---- mobile nav ---- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        var first = nav.querySelector("a");
        if (first) first.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        closeNav();
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") &&
          !nav.contains(e.target) && !toggle.contains(e.target)) {
        closeNav();
      }
    });
  }

  /* ---- demo banner offset (keeps the fixed header below the sticky
     "unofficial concept demo" bar; height varies with text wrap) ---- */
  var demoBanner = document.querySelector(".demo-banner");
  if (demoBanner) {
    var syncBannerH = function () {
      document.documentElement.style.setProperty("--demo-banner-h", demoBanner.offsetHeight + "px");
    };
    syncBannerH();
    if ("ResizeObserver" in window) {
      new ResizeObserver(syncBannerH).observe(demoBanner);
    } else {
      window.addEventListener("resize", syncBannerH, { passive: true });
    }
  }

  /* ---- teaser-demo mode: no backend; remove this block + set real Formspree ID when the paid build resumes ---- */
  var inquiryForm = document.querySelector('form[name="inquiry"]');
  if (inquiryForm) {
    var submitButton = inquiryForm.querySelector('button[type="submit"]');
    var submitLabel = inquiryForm.querySelector(".submit-label");
    var inquiryStatus = document.getElementById("inquiryStatus");
    inquiryForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (submitButton && submitButton.disabled) return;
      if (submitButton) submitButton.disabled = true;
      if (submitLabel) submitLabel.textContent = "Opening confirmation...";
      inquiryForm.setAttribute("aria-busy", "true");
      if (inquiryStatus) inquiryStatus.textContent = "Opening the demo thank-you page...";
      window.setTimeout(function () {
        window.location.href = "/thanks.html";
      }, 280);
    });
  }

  /* ---- header scroll state (transparent over hero → solid) ----
     Depends on the fixed .site-header and #hero existing; if #hero is
     missing it falls back to an 80px trigger. Math.max(40, …) guards a
     short/degenerate hero so the bar still solidifies. */
  var header = document.querySelector(".site-header");
  var heroEl = document.getElementById("hero");
  if (header) {
    var headerTicking = false;
    function syncHeader() {
      var trigger = heroEl ? heroEl.offsetHeight - header.offsetHeight : 80;
      header.classList.toggle("scrolled", window.scrollY > Math.max(40, trigger));
      headerTicking = false;
    }
    window.addEventListener("scroll", function () {
      if (!headerTicking) { window.requestAnimationFrame(syncHeader); headerTicking = true; }
    }, { passive: true });
    window.addEventListener("resize", syncHeader, { passive: true });
    syncHeader();
  }

  /* ---- scroll reveal (light fade-up) ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- active section highlight ---- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          navLinks.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + id);
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---- today's hours highlight ---- */
  var today = new Date().getDay(); // 0 = Sun ... 6 = Sat
  var row = document.querySelector('.hours tr[data-day="' + today + '"]');
  if (row) {
    row.classList.add("today");
    // non-colour cue for the highlighted row (WCAG 1.4.1) — the dot is decorative
    var th = row.querySelector("th");
    if (th && !th.querySelector(".sr-only")) {
      var tag = document.createElement("span");
      tag.className = "sr-only";
      tag.textContent = "Today — ";
      th.insertBefore(tag, th.firstChild);
    }
  }

  /* ---- mobile sticky CTA: slide away while the hero or inquiry form is in view
     (the CTA is redundant there — both already show an inquiry action) ---- */
  var mobileCta = document.getElementById("mobileCta");
  if (mobileCta && "IntersectionObserver" in window) {
    var ctaZones = [document.getElementById("hero"), document.getElementById("inquiry")].filter(Boolean);
    var ctaVisible = new Set();
    var ctaIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) ctaVisible.add(entry.target);
        else ctaVisible.delete(entry.target);
      });
      mobileCta.classList.toggle("mobile-cta--hidden", ctaVisible.size > 0);
    }, { threshold: 0.25 });
    ctaZones.forEach(function (z) { ctaIo.observe(z); });
  }

  /* ---- footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
