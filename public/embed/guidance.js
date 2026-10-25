/*
 * Edulexa career guidance form for institute websites.
 *
 *   <div data-edulexa-guidance data-institute="INSTITUTE_ID" data-form="FORM_ID"></div>
 *   <script src="https://app.edulexa.com/embed/guidance.js" async></script>
 *
 * Options (data-… on the div):
 *   data-mode         inline (default) | button (a button here that opens the form) | floating (a button in the corner)
 *   data-button-text  the button's words (button / floating)        default "Get career guidance"
 *   data-theme        light | dark | auto (follows the visitor)      default light
 *   data-corners      rounded | square                               default rounded
 *   data-font         inherit (your page's font) | system            default inherit
 *   data-heading      show | hide (hide when your page has its own)  default show
 *   data-accent       #rrggbb (overrides the form's colour)
 *   data-campaign     a campaign name (else utm_campaign / utm_source of your page)
 *
 * The form grows and shrinks with its content (no inner scrollbar). The page it's on and your page's UTM tags are
 * recorded with each inquiry. Nothing else is read from your page.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var origin = (function () {
    try {
      return new URL(script && script.src ? script.src : window.location.href).origin;
    } catch (e) {
      return "https://app.edulexa.com";
    }
  })();
  var MSG = "edulexa-guidance";
  var frames = [];

  function attr(el, name, fallback) {
    var v = el.getAttribute("data-" + name);
    return v === null || v === "" ? fallback : v;
  }

  // The page's font (only the family name), so the form blends in
  function pageFont(el) {
    try {
      var f = window.getComputedStyle(el).fontFamily || "";
      return f.replace(/[^\w\s,'"-]/g, "").slice(0, 120);
    } catch (e) {
      return "";
    }
  }

  function src(el, extra) {
    var page = new URL(window.location.href);
    var p = new URLSearchParams();
    var form = attr(el, "form", "");
    if (form) p.set("form", form);
    p.set("embed", "1");
    p.set("theme", attr(el, "theme", "light"));
    p.set("corners", attr(el, "corners", "rounded"));
    if (attr(el, "heading", "show") === "hide") p.set("heading", "hide");
    var accent = attr(el, "accent", "");
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) p.set("accent", accent);
    if (attr(el, "font", "inherit") === "inherit") {
      var f = pageFont(el);
      if (f) p.set("font", f);
    }
    var campaign = attr(el, "campaign", "") || page.searchParams.get("utm_campaign") || page.searchParams.get("utm_source") || "";
    if (campaign) p.set("campaign", campaign.slice(0, 120));
    ["utm_source", "utm_medium"].forEach(function (k) {
      var v = page.searchParams.get(k);
      if (v) p.set(k, v.slice(0, 120));
    });
    p.set("page", (page.host + page.pathname).slice(0, 120));
    if (extra) for (var k in extra) p.set(k, extra[k]);
    return origin + "/embed/guidance/" + encodeURIComponent(attr(el, "institute", "")) + "?" + p.toString();
  }

  function makeFrame(el, extra) {
    var f = document.createElement("iframe");
    f.src = src(el, extra);
    f.title = attr(el, "title", "Career guidance form");
    f.loading = "lazy";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "width:100%;border:0;display:block;height:640px;background:transparent;color-scheme:normal";
    frames.push(f);
    return f;
  }

  function buttonStyle(el, floating) {
    var accent = attr(el, "accent", "#4f46e5");
    var square = attr(el, "corners", "rounded") === "square";
    return (
      "font:inherit;font-weight:600;cursor:pointer;border:0;color:#fff;background:" + accent + ";padding:12px 18px;" +
      "border-radius:" + (square ? "4px" : "999px") + ";box-shadow:0 4px 14px rgba(0,0,0,.18);" +
      (floating ? "position:fixed;right:20px;bottom:20px;z-index:2147483000;" : "")
    );
  }

  function openPopup(el) {
    var overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", attr(el, "title", "Career guidance form"));
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px";
    var box = document.createElement("div");
    var square = attr(el, "corners", "rounded") === "square";
    box.style.cssText = "position:relative;width:100%;max-width:560px;background:" + (attr(el, "theme", "light") === "dark" ? "#0b1220" : "#fff") + ";border-radius:" + (square ? "6px" : "18px") + ";box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "&times;";
    close.style.cssText = "position:absolute;top:8px;right:10px;z-index:1;border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#64748b";
    var frame = makeFrame(el, { popup: "1" });
    box.appendChild(close);
    box.appendChild(frame);
    overlay.appendChild(box);
    var previous = document.activeElement;
    function shut() {
      document.removeEventListener("keydown", onKey);
      frames = frames.filter(function (x) { return x !== frame; });
      overlay.remove();
      document.documentElement.style.overflow = "";
      if (previous && previous.focus) previous.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") shut();
    }
    close.addEventListener("click", shut);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) shut();
    });
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(overlay);
    close.focus();
  }

  function mount(el) {
    if (el.getAttribute("data-edulexa-mounted")) return;
    el.setAttribute("data-edulexa-mounted", "1");
    if (!attr(el, "institute", "")) {
      el.textContent = "Edulexa: data-institute is missing.";
      return;
    }
    var mode = attr(el, "mode", "inline");
    if (mode === "button" || mode === "floating") {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = attr(el, "button-text", "Get career guidance");
      b.style.cssText = buttonStyle(el, mode === "floating");
      b.addEventListener("click", function () {
        openPopup(el);
      });
      el.appendChild(b);
      return;
    }
    el.appendChild(makeFrame(el));
  }

  // The form tells its frame how tall it is; only messages from Edulexa and from our own frames are used
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== MSG + ":height") return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        var h = Math.max(200, Math.min(6000, Number(e.data.height) || 0));
        frames[i].style.height = h + "px";
      }
    }
  });

  function scan() {
    var list = document.querySelectorAll("[data-edulexa-guidance]");
    for (var i = 0; i < list.length; i++) mount(list[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
