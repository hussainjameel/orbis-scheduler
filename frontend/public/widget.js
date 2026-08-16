/*
 * Orbis Scheduler embeddable booking widget.
 *
 * Plain, dependency-free JS — this runs unbundled on arbitrary third-party
 * pages that know nothing about React/Next, so it can't share any code with
 * the rest of this app. Everything it needs to visually approximate is
 * hand-copied here on purpose (see comments below), not imported.
 */
(function () {
  "use strict";

  var ROOT_ID = "orbis-widget-root";
  if (document.getElementById(ROOT_ID)) return; // duplicate <script> inclusion — no-op

  // --- Resolve this script's own tag, even if injected dynamically ---------
  var scriptEl = document.currentScript;
  if (!scriptEl) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/\/widget\.js(\?.*)?$/.test(scripts[i].src)) {
        scriptEl = scripts[i];
        break;
      }
    }
  }
  if (!scriptEl) {
    console.error("[Orbis widget] Could not locate its own <script> tag; nothing was injected.");
    return;
  }

  var businessId = scriptEl.getAttribute("data-business-id");
  if (!businessId) {
    console.error("[Orbis widget] Missing required data-business-id attribute on the widget <script> tag; nothing was injected.");
    return;
  }

  // Defaults to true (auto-inject the floating button) so every embed
  // snippet already generated before this option existed keeps working
  // unchanged — only an explicit "false" opts into a business wiring up
  // their own button via the window.Orbis API below.
  var autoButton = scriptEl.getAttribute("data-auto-button") !== "false";

  // Origin comes from wherever this file was actually loaded from, so the
  // same script works unmodified in dev (localhost) and production.
  var ORIGIN;
  try {
    ORIGIN = new URL(scriptEl.src).origin;
  } catch (e) {
    console.error("[Orbis widget] Could not determine the widget's own origin from its script src; nothing was injected.");
    return;
  }

  var BOOKING_URL = ORIGIN + "/book/" + encodeURIComponent(businessId);

  // --- Shadow DOM host, isolated from the host page in both directions ----
  var host = document.createElement("div");
  host.id = ROOT_ID;
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    // System font stack, not Google Fonts' DM Sans (the app's real UI font):
    // pulling a webfont into every host page this widget lands on would add a
    // render-blocking network request and an external dependency to somebody
    // else's site just for one button. Deliberate safe/fast-over-exact-brand-
    // match tradeoff, not an oversight.
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}",
    "@media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}",

    ".orbis-btn{position:fixed;right:20px;bottom:20px;z-index:2147483647;display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 20px;border:0;border-radius:9999px;background:#e8590c;color:#fff;font-size:15px;font-weight:500;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:background .15s ease,transform .1s ease;}",
    ".orbis-btn:hover{background:#d14d08;}",
    ".orbis-btn:active{transform:translateY(1px);}",
    ".orbis-btn:focus-visible{outline:2px solid #e8590c;outline-offset:2px;}",

    ".orbis-backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .15s ease;}",
    ".orbis-backdrop.orbis-open{display:flex;opacity:1;}",

    ".orbis-panel{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column;}",
    ".orbis-panel.orbis-fullscreen{border-radius:0;}",

    ".orbis-close{position:absolute;top:12px;right:12px;z-index:2;width:32px;height:32px;border:0;border-radius:9999px;background:rgba(0,0,0,.06);color:#131211;display:flex;align-items:center;justify-content:center;cursor:pointer;}",
    ".orbis-close:hover{background:rgba(0,0,0,.12);}",
    ".orbis-close:focus-visible{outline:2px solid #e8590c;outline-offset:2px;}",

    ".orbis-iframe{width:100%;height:100%;border:0;display:block;background:#fff;}",

    ".orbis-spinner-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;transition:opacity .15s ease;}",
    ".orbis-spinner-wrap.orbis-hidden{opacity:0;pointer-events:none;}",
    // Same two-path Orbis mark used by the app's real LogoSpinner component,
    // hand-copied here (SVG path data is static markup, not React) since the
    // component itself can't be imported into a vanilla script. Fill comes
    // from currentColor (set via .orbis-spinner-wrap's color below) rather
    // than a hardcoded attribute, so it can respond to the dark-mode rules.
    "@keyframes orbis-spin-a{0%,49%{opacity:1;}50%,100%{opacity:0;}}",
    "@keyframes orbis-spin-b{0%,49%{opacity:0;}50%,100%{opacity:1;}}",
    ".orbis-spin-a{animation:orbis-spin-a 800ms steps(1) infinite;}",
    ".orbis-spin-b{animation:orbis-spin-b 800ms steps(1) infinite;}",
    ".orbis-spinner-wrap svg{fill:currentColor;}",
    ".orbis-spinner-wrap{color:#e8590c;}",

    // --- Dark mode ---------------------------------------------------
    // Follows the VISITOR's OS preference only (window.matchMedia below) —
    // never the host page's own theme/branding, which Shadow DOM correctly
    // has no way to read anyway. Values are this app's own real dark-mode
    // design tokens (globals.css's .dark block), copied here the same way
    // brand orange already was, not invented. :host(.dark) lets these rules
    // react to a class toggled on the shadow host from JS. The backdrop is
    // deliberately left unchanged in both modes — the real app's own dialog
    // overlay uses the same black/50 scrim regardless of theme.
    ":host(.dark) .orbis-btn{background:#f26b1d;color:#1a1817;}",
    ":host(.dark) .orbis-btn:hover{background:#ff7c33;}",
    ":host(.dark) .orbis-btn:focus-visible{outline-color:#f26b1d;}",
    ":host(.dark) .orbis-panel{background:#232120;border:1px solid #33302c;}",
    ":host(.dark) .orbis-close{background:rgba(255,255,255,.08);color:#f5f2ed;}",
    ":host(.dark) .orbis-close:hover{background:rgba(255,255,255,.14);}",
    ":host(.dark) .orbis-close:focus-visible{outline-color:#f26b1d;}",
    ":host(.dark) .orbis-iframe{background:#232120;}",
    ":host(.dark) .orbis-spinner-wrap{background:#232120;color:#f26b1d;}"
  ].join("\n");
  shadow.appendChild(style);

  // Reacts only to the visitor's own OS/browser preference — never an
  // attempt to read or match the host page's theme, which Shadow DOM
  // deliberately blocks anyway. Applied once at init and kept live, since
  // some devices switch preference mid-session (e.g. sunset-triggered).
  var darkMql = window.matchMedia("(prefers-color-scheme: dark)");
  function applyColorScheme(isDark) {
    host.classList.toggle("dark", isDark);
  }
  applyColorScheme(darkMql.matches);
  darkMql.addEventListener("change", function (e) {
    applyColorScheme(e.matches);
  });

  // --- Floating button (auto-inject mode only) ---------------------------
  var btn = null;
  if (autoButton) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "orbis-btn";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.textContent = "Book now";
    shadow.appendChild(btn);
  }

  // --- Modal (built once, hidden until first open) ----------------------
  var backdrop = document.createElement("div");
  backdrop.className = "orbis-backdrop";

  var panel = document.createElement("div");
  panel.className = "orbis-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Book an appointment");
  panel.tabIndex = -1;

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "orbis-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2 2L14 14M14 2L2 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  var spinnerWrap = document.createElement("div");
  spinnerWrap.className = "orbis-spinner-wrap";
  spinnerWrap.innerHTML =
    '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">' +
    '<path class="orbis-spin-a" d="M 16 16 L 22.5 4.74 A 13 13 0 0 1 9.5 27.26 Z"/>' +
    '<path class="orbis-spin-b" d="M 16 16 L 9.5 27.26 A 13 13 0 0 1 22.5 4.74 Z"/></svg>';

  var iframe = null; // created lazily on first open, so a visitor who never clicks never triggers the request

  panel.appendChild(closeBtn);
  panel.appendChild(spinnerWrap);
  backdrop.appendChild(panel);
  shadow.appendChild(backdrop);

  // --- Responsive panel sizing -------------------------------------------
  // Driven by the widget's own window.innerWidth/innerHeight, not CSS media
  // queries — the modal is fixed-positioned relative to the real host-page
  // viewport, not constrained by whatever container happens to hold the
  // <script> tag on the host's page. Mirrors the real booking page's own
  // sm: (640px) layout switch and its 700/820/960px content-width steps, so
  // the SAME desktop-vs-mobile decision fires inside the iframe as would
  // fire on a direct visit at the same viewport size.
  function getPanelSize() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    if (w < 640) {
      return { width: w, height: h, fullscreen: true };
    }

    var minDesktopWidth = 648; // just clears the booking page's own 640px sm: breakpoint
    var idealWidth = Math.min(w - 64, 1008); // ~960px 2xl content cap + its own 24px*2 padding, with backdrop margin
    var width = Math.max(minDesktopWidth, Math.min(idealWidth, w - 8));
    var height = Math.min(h - 80, 820);

    return { width: width, height: height, fullscreen: false };
  }

  function applyPanelSize() {
    var size = getPanelSize();
    if (size.fullscreen) {
      panel.classList.add("orbis-fullscreen");
      panel.style.width = size.width + "px";
      panel.style.height = size.height + "px";
    } else {
      panel.classList.remove("orbis-fullscreen");
      panel.style.width = size.width + "px";
      panel.style.height = size.height + "px";
    }
  }

  // --- Open / close --------------------------------------------------
  var isOpen = false;
  var previousBodyOverflow = "";
  var externalPreviousFocus = null; // custom-button mode only, see close()

  function onIframeLoad() {
    spinnerWrap.classList.add("orbis-hidden");
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    if (!autoButton) {
      // Safe here in a way it wasn't for the auto-injected button: this
      // only runs when open() is called externally (a business's own
      // button, via window.Orbis.open), which lives in the host page's
      // ordinary light DOM — not inside our shadow tree — so
      // document.activeElement resolves to it directly, with none of the
      // shadow-host focus-retargeting that made this unreliable elsewhere.
      externalPreviousFocus = document.activeElement;
    }

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "orbis-iframe";
      iframe.title = "Book an appointment";
      iframe.addEventListener("load", onIframeLoad);
      panel.appendChild(iframe);
    }
    spinnerWrap.classList.remove("orbis-hidden");
    // Reload fresh on every open, not just the first — availability may have
    // changed since a visitor last had this open. Re-assigning an identical
    // src is a browser no-op, so a changing hash fragment forces a real
    // navigation every time (the booking page ignores it; nothing reads
    // location.hash). This script always executes as part of the HOST
    // page's document — a <script src> runs in the origin of the document
    // that loaded it, not the origin its file was fetched from — so the
    // iframe's content is cross-origin from this script's own context by
    // design, on every embed, with no same-origin case to rely on.
    // iframe.contentWindow is therefore off-limits (confirmed by a real
    // SecurityError during verification: "Blocked a frame with origin ...
    // from accessing a frame with origin ...") — src reassignment is the
    // only cross-origin-safe way to trigger this.
    iframe.src = BOOKING_URL + "#w=" + Date.now();

    applyPanelSize();
    backdrop.classList.add("orbis-open");

    // Restore whatever the host page's own inline overflow value was on
    // close, rather than forcing it back to a hardcoded "visible" — a host
    // page may have had its own reason for setting it.
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel.focus();

    window.addEventListener("resize", applyPanelSize);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    backdrop.classList.remove("orbis-open");
    document.body.style.overflow = previousBodyOverflow;

    window.removeEventListener("resize", applyPanelSize);
    document.removeEventListener("keydown", onKeyDown, true);

    if (autoButton) {
      // The button is the only way this modal is ever opened in this mode,
      // so it's always the correct place to return focus — not "whatever
      // document.activeElement was," which retargets to the shadow *host*
      // div (a non-focusable element) once focus is inside the shadow tree,
      // per the DOM spec's focus-retargeting rules, and would silently
      // no-op if relied on here.
      btn.focus();
    } else if (externalPreviousFocus && typeof externalPreviousFocus.focus === "function") {
      externalPreviousFocus.focus();
    }
    externalPreviousFocus = null;
  }

  function getFocusable() {
    // Only two real stops inside the panel: the close button and the iframe
    // itself (a framed document is a single, real focusable stop from the
    // host page's perspective, regardless of what's focusable inside it).
    return [closeBtn, iframe].filter(Boolean);
  }

  function onKeyDown(e) {
    if (!isOpen) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;

    var focusable = getFocusable();
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = shadow.activeElement;

    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (btn) btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) close(); // only the dimmed area itself, not clicks bubbling from the panel
  });

  // This script always runs in the host page's own origin (see the reload
  // comment in open() above), so the iframe's content is cross-origin from
  // it on every embed — once focus moves into the iframe (as soon as a
  // visitor touches the form), a real Escape keydown fires on the iframe's
  // own document and never reaches this page's keydown listener above. The
  // booking page forwards it here via postMessage instead; origin-checked
  // (against ORIGIN, the real origin of that page's own document, which
  // postMessage always reports correctly regardless of the sender's own
  // execution context) so only that real page can trigger a close this way.
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    if (e.data && e.data.source === "orbis-widget" && e.data.type === "escape") close();
  });

  // Public API — lets a business wire their own existing button to this
  // same modal (onclick="Orbis.open()") when data-auto-button="false".
  // A single global: this product has no realistic scenario needing two
  // different businesses' widgets on one page, so multi-instance isn't
  // handled — a second widget load would just overwrite this with its own
  // open/close (the duplicate-load guard above already prevents the more
  // likely case of the *same* business's snippet appearing twice).
  window.Orbis = { open: open, close: close };
})();
