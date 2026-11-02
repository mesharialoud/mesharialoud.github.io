(function () {
  "use strict";
  var CFG = window.BOOKING_CONFIG || {};
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };

  var L = {
    en: { taken: "That time was just taken. Please choose another.", rate: "Too many requests. Please try again later or message me on WhatsApp.",
      captcha: "Please complete the security check.", invalid: "Please check your details and try again.", slot: "That time is no longer available. Please choose another.",
      mail: "We couldn't send your request. Please try again, or message me on WhatsApp.", net: "Connection problem. Please try again.", sending: "Sending…",
      none: "No times are available right now. Please check back soon or message me on WhatsApp.", at: "at", sel: "Selected:" },
    ar: { taken: "تم حجز هذا الوقت للتو. الرجاء اختيار وقت آخر.", rate: "طلبات كثيرة. حاول لاحقاً أو راسلني على واتساب.",
      captcha: "الرجاء إكمال التحقق الأمني.", invalid: "الرجاء التحقق من بياناتك والمحاولة مرة أخرى.", slot: "هذا الوقت لم يعد متاحاً. الرجاء اختيار وقت آخر.",
      mail: "تعذّر إرسال طلبك. حاول مرة أخرى أو راسلني على واتساب.", net: "مشكلة في الاتصال. حاول مرة أخرى.", sending: "جارٍ الإرسال…",
      none: "لا توجد مواعيد متاحة حالياً. عاود المحاولة قريباً أو راسلني على واتساب.", at: "الساعة", sel: "المحدد:" }
  };
  var lang = "en", data = null, selDate = null, selSlot = null, token = "", busy = false;
  var t = function (k) { return L[lang][k]; };

  /* ---- language & theme (shared with the main site) ---- */
  function setLang(l, persist) {
    lang = l; root.lang = l; root.dir = l === "ar" ? "rtl" : "ltr";
    document.title = l === "ar" ? "فنجان قهوة — احجز لقاءً مع مشاري العود" : "Have a Cup of Coffee — Book a conversation with Meshari Aloud";
    if (persist) { try { localStorage.setItem("lang", l); } catch (e) {} }
    renderDays(); renderTimes(); renderSummary();
  }
  function setTheme(th) {
    root.dataset.theme = th;
    var m = document.querySelector("meta[name=theme-color]"); if (m) m.content = th === "light" ? "#faf7f1" : "#161616";
    try { localStorage.setItem("theme", th); } catch (e) {}
  }
  var q = new URLSearchParams(location.search).get("lang"), saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  var initial = q === "ar" || q === "en" ? q : (saved || ((navigator.language || "").indexOf("ar") === 0 ? "ar" : "en"));
  $("lang").onclick = function () { setLang(lang === "ar" ? "en" : "ar", true); };
  $("theme").onclick = function () { setTheme(root.dataset.theme === "light" ? "dark" : "light"); };
  $("year").textContent = new Date().getFullYear();

  /* ---- rendering ---- */
  function dateParts(dateStr) {
    var p = dateStr.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    var loc = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
    return {
      wd: new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "short" }).format(d),
      num: new Intl.DateTimeFormat(loc, { timeZone: "UTC", day: "numeric", month: "short" }).format(d),
      full: new Intl.DateTimeFormat(loc, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(d)
    };
  }
  function renderDays() {
    var box = $("days"); box.innerHTML = ""; if (!data) return;
    data.days.forEach(function (d) {
      var p = dateParts(d.date), b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (d.date === selDate ? " on" : "");
      b.innerHTML = "<small></small><span></span>"; b.firstChild.textContent = p.wd; b.lastChild.textContent = p.num;
      b.onclick = function () { selDate = d.date; selSlot = null; renderDays(); renderTimes(); renderSummary(); check(); };
      box.appendChild(b);
    });
  }
  function renderTimes() {
    var box = $("times"); if (!data) return;
    var day = data.days.filter(function (d) { return d.date === selDate; })[0];
    if (!day) { return; }
    box.innerHTML = "";
    day.slots.forEach(function (s) {
      var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (s.start === selSlot ? " on" : "");
      b.textContent = s.time; b.dir = "ltr";
      b.onclick = function () { selSlot = s.start; renderTimes(); renderSummary(); check(); };
      box.appendChild(b);
    });
  }
  function selectedLabel() {
    if (!selSlot) return null;
    var day = data.days.filter(function (d) { return d.date === selDate; })[0];
    var s = day.slots.filter(function (x) { return x.start === selSlot; })[0];
    return dateParts(selDate).full + " " + t("at") + " " + s.time;
  }
  function renderSummary() {
    var el = $("summary"), lbl = data && selectedLabel();
    el.hidden = !lbl; if (lbl) el.textContent = t("sel") + " " + lbl;
  }
  function showError(msg) { var e = $("error"); e.hidden = !msg; e.textContent = msg || ""; }

  /* ---- validation ---- */
  var rx = { phone: /^\+?[0-9 ()\-]{7,20}$/, email: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/ };
  function valid(mark) {
    var ok = true, f = {
      fName: $("fName").value.trim().length >= 2,
      fPhone: rx.phone.test($("fPhone").value.trim()),
      fEmail: rx.email.test($("fEmail").value.trim())
    };
    Object.keys(f).forEach(function (k) { if (!f[k]) ok = false; if (mark) $(k).classList.toggle("bad", !f[k]); });
    return ok;
  }
  function check() { $("submit").disabled = busy || !(selSlot && $("fAgree").checked && valid(false) && (!CFG.TURNSTILE_SITEKEY || token)); }
  ["fName", "fPhone", "fEmail", "fNote", "fAgree"].forEach(function (id) { $(id).addEventListener("input", check); $(id).addEventListener("change", check); });

  /* ---- load slots ---- */
  function closed() {
    $("loading").hidden = true; $("form").hidden = true; $("closed").hidden = false;
    $("cWa").href = "https://wa.me/" + (CFG.WHATSAPP || ""); $("cMail").href = "mailto:" + (CFG.EMAIL || "");
  }
  function api(path, opt) { return fetch((CFG.API_BASE || "").replace(/\/$/, "") + path, opt); }
  function load() {
    if (!CFG.API_BASE) { closed(); return; }
    api("/api/slots").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      data = j; $("loading").hidden = true;
      if (!j.days.length) { closed(); $("closed").querySelector("p b").textContent = t("none"); return; }
      $("form").hidden = false; selDate = null; selSlot = null; renderDays();
      if (CFG.TURNSTILE_SITEKEY) loadTurnstile();
    }).catch(closed);
  }
  function loadTurnstile() {
    var s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
    s.onload = function () { window.turnstile.render("#ts", { sitekey: CFG.TURNSTILE_SITEKEY, callback: function (tk) { token = tk; check(); }, "expired-callback": function () { token = ""; check(); } }); };
    document.head.appendChild(s);
  }

  /* ---- submit ---- */
  $("form").addEventListener("submit", function (e) {
    e.preventDefault(); showError("");
    if (!valid(true) || !selSlot || !$("fAgree").checked) { showError(t("invalid")); return; }
    busy = true; check(); var btn = $("submit"), old = btn.innerHTML; btn.textContent = t("sending");
    var label = selectedLabel();
    api("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      slot: selSlot, name: $("fName").value, phone: $("fPhone").value, email: $("fEmail").value, note: $("fNote").value,
      lang: lang, hp: $("fHp").value, token: token }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        if (x.j.ok) { $("form").hidden = true; $("done").hidden = false; $("doneWhen").textContent = label; window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        var m = { slot_taken: "taken", slot_invalid: "slot", rate_limited: "rate", captcha: "captcha", invalid: "invalid", email_failed: "mail" }[x.j.error] || "net";
        showError(t(m));
        if (m === "taken" || m === "slot") { selSlot = null; load(); }
        if (window.turnstile && CFG.TURNSTILE_SITEKEY) { token = ""; try { window.turnstile.reset(); } catch (e) {} }
      })
      .catch(function () { showError(t("net")); })
      .then(function () { busy = false; btn.innerHTML = old; check(); });
  });

  setLang(initial, false);
  load();
})();
