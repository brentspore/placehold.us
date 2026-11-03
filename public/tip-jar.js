/* placehold.us tip jar. Same badge as One Page Toys and BuildUtilities: a
 * coffee cup docked at right-center that opens to a "Tip Jar" pill on hover
 * and links to the studio's Ko-fi page (cards, Apple Pay, Google Pay, PayPal).
 *
 * The ask: this is a reference page, not a game, so there is no "finished"
 * moment to hook. Instead the badge nudges once, on the third different day a
 * visitor comes back (people who return are the ones relying on the service),
 * then rests 21 days, and never asks again after a tip-jar click.
 * State lives only in this browser: localStorage `phu_tipjar_v1`.
 */
(function () {
  "use strict";

  var TIP_URL = "https://ko-fi.com/synergyprod";
  var ASK_AFTER_DAYS = 3; // distinct visit days before the first nudge
  var COOLDOWN_DAYS = 21;
  var OPEN_MS = 6000; // how long the pill stays open after a nudge (phones never hover)
  var KEY = "phu_tipjar_v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: never nudges */ }
  }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (e) {}
  }

  var css =
    ".phu-tipjar{position:fixed;right:max(16px,env(safe-area-inset-right));top:50%;transform:translateY(-50%);z-index:1000;" +
    "display:inline-flex;align-items:center;height:46px;overflow:hidden;background:#fff;color:#222;" +
    "border:1.5px solid #222;border-radius:999px;box-shadow:0 6px 20px rgba(34,34,34,.22);text-decoration:none;" +
    "transition:background .16s ease,color .16s ease,border-color .16s ease;}" +
    ".phu-tipjar__jar{flex:0 0 auto;width:44px;height:44px;display:grid;place-items:center;}" +
    ".phu-tipjar__logo{height:26px;width:auto;display:block;}" +
    ".phu-tipjar__label{max-width:0;opacity:0;overflow:hidden;white-space:nowrap;font-family:'AauxOffice',Arial,sans-serif;" +
    "font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;" +
    "transition:max-width .26s cubic-bezier(.2,.85,.25,1),opacity .2s ease,padding .26s ease;}" +
    ".phu-tipjar:hover,.phu-tipjar:focus-visible,.phu-tipjar.is-open{background:#E8117F;color:#fff;border-color:#E8117F;outline:none;}" +
    ".phu-tipjar:hover .phu-tipjar__label,.phu-tipjar:focus-visible .phu-tipjar__label,.phu-tipjar.is-open .phu-tipjar__label{max-width:140px;opacity:1;padding-left:16px;}" +
    ".phu-tipjar:focus-visible{box-shadow:0 0 0 2px #fff,0 0 0 5px rgba(232,17,127,.55),0 6px 20px rgba(34,34,34,.22);}" +
    "@keyframes phuNudge{0%,100%{transform:translateY(-50%) scale(1) rotate(0)}14%{transform:translateY(-50%) scale(1.14) rotate(-8deg)}32%{transform:translateY(-50%) scale(1.08) rotate(7deg)}50%{transform:translateY(-50%) scale(1.1) rotate(-4deg)}70%{transform:translateY(-50%) scale(1.04) rotate(2deg)}}" +
    ".phu-tipjar.is-nudge{animation:phuNudge 950ms cubic-bezier(.36,.07,.19,.97);}" +
    "@media (max-width:560px){.phu-tipjar{right:max(8px,env(safe-area-inset-right));height:40px;}.phu-tipjar__jar{width:38px;height:38px;}.phu-tipjar__logo{height:22px;}}" +
    "@media (prefers-reduced-motion:reduce){.phu-tipjar,.phu-tipjar__label{transition:none;}.phu-tipjar.is-nudge{animation:none;}}" +
    "@media print{.phu-tipjar{display:none;}}";

  function mount() {
    if (document.querySelector(".phu-tipjar")) return;
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    var a = document.createElement("a");
    a.className = "phu-tipjar";
    a.href = TIP_URL;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = "Support placehold.us";
    a.setAttribute("aria-label", "Tip Jar: support placehold.us");
    a.innerHTML =
      '<span class="phu-tipjar__label">Tip Jar</span>' +
      '<span class="phu-tipjar__jar" aria-hidden="true">' +
      '<svg class="phu-tipjar__logo" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
      '<path fill="currentColor" d="M3.5 10.5h14.2v5.1c0 3.5-2.8 6.3-6.3 6.3H9.8c-3.5 0-6.3-2.8-6.3-6.3z"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="2.1" d="M17.7 12.2h1.6a2.6 2.6 0 0 1 0 5.2h-1.6"/>' +
      '<rect x="2.6" y="23.2" width="16" height="1.9" rx=".95" fill="currentColor"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M8 7.6c0-1.6 1.6-1.6 1.6-3.2M12.3 7.6c0-1.6 1.6-1.6 1.6-3.2"/>' +
      "</svg></span>";
    a.addEventListener("animationend", function () { a.classList.remove("is-nudge"); });
    document.body.appendChild(a);

    // Any tip link on the page (badge or footer) counts as a click.
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest('a[href^="' + TIP_URL + '"]');
      if (!link) return;
      var s = read();
      s.clicked = Date.now();
      write(s);
      track("tip_jar_click", { page: location.pathname, source: link === a ? "badge" : "footer" });
    });

    maybeNudge(a);
  }

  function maybeNudge(a) {
    var s = read();
    var today = new Date().toISOString().slice(0, 10);
    var days = Array.isArray(s.days) ? s.days : [];
    if (days.indexOf(today) === -1) days.push(today);
    s.days = days.slice(-10);
    var now = Date.now();
    var due = days.length >= ASK_AFTER_DAYS && !s.clicked && (!s.asked || now - s.asked > COOLDOWN_DAYS * 864e5);
    if (due) s.asked = now;
    write(s);
    if (!due) return;

    // Wait a moment so the nudge doesn't land while the page is still settling.
    setTimeout(function () {
      if (!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        a.classList.add("is-nudge");
      }
      a.classList.add("is-open");
      setTimeout(function () { a.classList.remove("is-open"); }, OPEN_MS);
      track("tip_ask_shown", { page: location.pathname, days: days.length });
    }, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
