/**
 * mesharialoud.com — "Have a Cup of Coffee" booking API
 * Single-file Cloudflare Worker (no dependencies). Storage: Cloudflare D1. Email: Resend.
 *
 * Routes
 *   GET  /api/slots            -> available time slots
 *   POST /api/book             -> create a booking request (status: pending)
 *   GET  /api/decide?id&a&sig  -> owner confirmation page (approve / decline)
 *   POST /api/decide?id&a&sig  -> performs the decision, emails the customer
 *
 * Bindings / secrets: see wrangler.toml and README.md
 */

// ───────────── Edit these to change when you are bookable ─────────────
const CONFIG = {
  tzOffsetHours: 3,            // Kuwait = UTC+3 (no daylight saving)
  days: [0, 1, 2, 3, 4],       // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  start: "17:00",              // first slot starts at (Kuwait time)
  end: "20:00",                // last slot ends at   (Kuwait time)
  slotMinutes: 30,
  horizonDays: 21,             // how far ahead people can book
  minNoticeHours: 12,          // no bookings closer than this
  blockedDates: [],            // e.g. ["2026-12-25"]  (YYYY-MM-DD, Kuwait date)
  feeKwd: 10,
  pendingExpiryHours: 48,      // un-approved requests free their slot after this
  maxPerIpPerHour: 5,
};
// ──────────────────────────────────────────────────────────────────────

const SERVICE = { en: "Have a Cup of Coffee", ar: "فنجان قهوة" };

/* ---------- small helpers ---------- */
const enc = new TextEncoder();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function newId() { const b = crypto.getRandomValues(new Uint8Array(12)); return hex(b); }

const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
  }
  return { Vary: "Origin" };
}
function json(data, status, req, env) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...SEC_HEADERS, ...corsHeaders(req, env) } });
}
function page(html, status = 200) {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...SEC_HEADERS,
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}

/* ---------- time / slots (Kuwait time) ---------- */
function kuwaitNow(now) { return new Date(now.getTime() + CONFIG.tzOffsetHours * 3600e3); }
function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

/** All slots the rules allow in the booking window (not yet filtered by existing bookings). */
function generateSlots(now = new Date()) {
  const out = [];
  const k = kuwaitNow(now);
  const minStart = now.getTime() + CONFIG.minNoticeHours * 3600e3;
  for (let d = 0; d <= CONFIG.horizonDays; d++) {
    const day = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + d));
    const dateStr = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    if (!CONFIG.days.includes(day.getUTCDay()) || CONFIG.blockedDates.includes(dateStr)) continue;
    for (let t = toMin(CONFIG.start); t + CONFIG.slotMinutes <= toMin(CONFIG.end); t += CONFIG.slotMinutes) {
      const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, t - CONFIG.tzOffsetHours * 60);
      if (utc < minStart) continue;
      out.push({ date: dateStr, time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, start: new Date(utc).toISOString().replace(".000Z", "Z") });
    }
  }
  return out;
}
async function takenSlots(env, now) {
  const rows = await env.DB.prepare("SELECT slot_utc FROM bookings WHERE status IN ('pending','confirmed') AND slot_utc >= ?")
    .bind(now.toISOString()).all();
  return new Set((rows.results || []).map((r) => r.slot_utc));
}
async function expireOld(env, now) {
  const cutoff = new Date(now.getTime() - CONFIG.pendingExpiryHours * 3600e3).toISOString();
  await env.DB.prepare("UPDATE bookings SET status='expired' WHERE status='pending' AND created_at < ?").bind(cutoff).run();
}
function fmtSlot(iso, lang) {
  const d = new Date(iso);
  const loc = lang === "ar" ? "ar-u-nu-latn" : "en-GB";
  const date = new Intl.DateTimeFormat(loc, { timeZone: "Asia/Kuwait", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuwait", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

/* ---------- validation ---------- */
function clean(v, max) { return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max); }
function validate(b) {
  const name = clean(b.name, 80), phone = clean(b.phone, 20), email = clean(b.email, 254), note = clean(b.note, 600);
  const lang = b.lang === "ar" ? "ar" : "en";
  const errors = {};
  if (name.length < 2) errors.name = "name";
  if (!/^\+?[0-9 ()\-]{7,20}$/.test(phone)) errors.phone = "phone";
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) errors.email = "email";
  return { ok: !Object.keys(errors).length, errors, v: { name, phone, email, note, lang } };
}

/* ---------- email (Resend) ---------- */
async function sendEmail(env, { to, subject, html, text, replyTo, attachments }) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html, text, reply_to: replyTo, attachments }),
  });
  if (!r.ok) throw new Error("Email failed " + r.status + " " + (await r.text()).slice(0, 200));
}
function wrapEmail(inner, lang) {
  const rtl = lang === "ar";
  return `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;background:#f4f1ea;padding:24px;font-family:${rtl ? "Tahoma,Arial" : "Arial,Helvetica"},sans-serif;color:#1c1b19">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;line-height:1.7;text-align:${rtl ? "right" : "left"}">${inner}
<p style="color:#8a6a28;margin-top:28px;font-size:13px">Meshari Aloud · mesharialoud.com</p></div></body></html>`;
}
function ics(b) {
  const s = new Date(b.slot_utc), e = new Date(s.getTime() + CONFIG.slotMinutes * 60e3);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//mesharialoud.com//Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${b.id}@mesharialoud.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(s)}`, `DTEND:${f(e)}`,
    "SUMMARY:Have a Cup of Coffee with Meshari Aloud", "DESCRIPTION:Time shown in your calendar's local time zone.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

const T = {
  received: {
    en: (b, w) => ({ subject: `We received your request — ${SERVICE.en}`,
      body: `<h2 style="margin-top:0">Thank you, ${esc(b.name)}</h2><p>I received your request for <b>${SERVICE.en}</b> on <b>${w.date} at ${w.time}</b> (Kuwait time).</p><p>I will confirm shortly by email. The reservation fee is <b>${CONFIG.feeKwd} KD</b> (non-refundable); I will send you the secure payment details with the confirmation.</p>` }),
    ar: (b, w) => ({ subject: `تم استلام طلبك — ${SERVICE.ar}`,
      body: `<h2 style="margin-top:0">شكراً ${esc(b.name)}</h2><p>استلمت طلبك لحجز <b>${SERVICE.ar}</b> يوم <b>${w.date} الساعة ${w.time}</b> (بتوقيت الكويت).</p><p>سأؤكد الموعد قريباً عبر البريد الإلكتروني. رسوم الحجز <b>${CONFIG.feeKwd} د.ك</b> (غير قابلة للاسترداد)، وسأرسل لك تفاصيل الدفع الآمن مع التأكيد.</p>` }),
  },
  confirmed: {
    en: (b, w) => ({ subject: `Confirmed — ${SERVICE.en}, ${w.date} ${w.time}`,
      body: `<h2 style="margin-top:0">You're confirmed ☕</h2><p><b>${w.date} at ${w.time}</b> (Kuwait time, ${CONFIG.slotMinutes} minutes).</p><p>A calendar invite is attached. I will send you the payment link for the <b>${CONFIG.feeKwd} KD</b> reservation fee (non-refundable) and the meeting details. Reply to this email if anything changes.</p>` }),
    ar: (b, w) => ({ subject: `تم التأكيد — ${SERVICE.ar}، ${w.date} ${w.time}`,
      body: `<h2 style="margin-top:0">تم تأكيد موعدك ☕</h2><p><b>${w.date} الساعة ${w.time}</b> (بتوقيت الكويت، ${CONFIG.slotMinutes} دقيقة).</p><p>مرفق دعوة التقويم. سأرسل لك رابط دفع رسوم الحجز <b>${CONFIG.feeKwd} د.ك</b> (غير قابلة للاسترداد) وتفاصيل اللقاء. للتعديل يمكنك الرد على هذه الرسالة.</p>` }),
  },
  declined: {
    en: (b, w) => ({ subject: `About your request — ${SERVICE.en}`,
      body: `<p>Hello ${esc(b.name)},</p><p>Unfortunately I can't meet at <b>${w.date} at ${w.time}</b>. Please pick another time on the booking page, or reply to this email and we'll find one together.</p>` }),
    ar: (b, w) => ({ subject: `بخصوص طلبك — ${SERVICE.ar}`,
      body: `<p>مرحباً ${esc(b.name)}،</p><p>للأسف لا يناسبني الموعد <b>${w.date} الساعة ${w.time}</b>. يمكنك اختيار وقت آخر من صفحة الحجز، أو الرد على هذه الرسالة لنتفق على موعد مناسب.</p>` }),
  },
};

/* ---------- handlers ---------- */
async function handleSlots(req, env) {
  const now = new Date();
  await expireOld(env, now);
  const taken = await takenSlots(env, now);
  const days = {};
  for (const s of generateSlots(now)) {
    if (taken.has(s.start)) continue;
    (days[s.date] ||= []).push({ start: s.start, time: s.time });
  }
  return json({ tz: "Asia/Kuwait", feeKwd: CONFIG.feeKwd, currency: "KWD", slotMinutes: CONFIG.slotMinutes,
    days: Object.entries(days).map(([date, slots]) => ({ date, slots })) }, 200, req, env);
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  return !!j.success;
}

async function handleBook(req, env) {
  const raw = await req.text();
  if (raw.length > 5000) return json({ ok: false, error: "too_large" }, 413, req, env);
  let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: "bad_json" }, 400, req, env); }
  if (b.hp) return json({ ok: true }, 200, req, env);                         // honeypot: pretend success to bots

  const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
  if (!(await verifyTurnstile(env, b.token, ip))) return json({ ok: false, error: "captcha" }, 400, req, env);

  const val = validate(b);
  if (!val.ok) return json({ ok: false, error: "invalid", fields: val.errors }, 400, req, env);
  const v = val.v;

  const now = new Date();
  const slot = generateSlots(now).find((s) => s.start === b.slot);
  if (!slot) return json({ ok: false, error: "slot_invalid" }, 400, req, env);

  await expireOld(env, now);
  const ipHash = (await sha256(ip + (env.SIGNING_SECRET || ""))).slice(0, 32);
  const since = new Date(now.getTime() - 3600e3).toISOString();
  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > ?").bind(ipHash, since).first();
  if ((c?.n || 0) >= CONFIG.maxPerIpPerHour) return json({ ok: false, error: "rate_limited" }, 429, req, env);

  const id = newId();
  try {
    await env.DB.prepare("INSERT INTO bookings (id, slot_utc, name, phone, email, note, lang, status, fee_kwd, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,'pending',?,?,?)")
      .bind(id, slot.start, v.name, v.phone, v.email, v.note, v.lang, CONFIG.feeKwd, ipHash, now.toISOString()).run();
  } catch (e) {
    if (String(e.message || e).includes("UNIQUE")) return json({ ok: false, error: "slot_taken" }, 409, req, env);
    throw e;
  }

  // Notify the owner first. If that fails, roll back so a booking is never silently lost.
  const base = new URL(req.url).origin;
  const link = async (a) => `${base}/api/decide?id=${id}&a=${a}&sig=${await hmac(env.SIGNING_SECRET, id + "." + a)}`;
  const w = fmtSlot(slot.start, "en");
  try {
    await sendEmail(env, {
      to: env.OWNER_EMAIL, replyTo: v.email,
      subject: `New booking request — ${w.date} ${w.time}`,
      html: wrapEmail(`<h2 style="margin-top:0">New "${SERVICE.en}" request</h2>
        <p><b>${w.date} at ${w.time}</b> (Kuwait time)</p>
        <p><b>${esc(v.name)}</b><br>Phone/WhatsApp: ${esc(v.phone)}<br>Email: ${esc(v.email)}<br>Language: ${v.lang}</p>
        ${v.note ? `<p style="background:#faf7f1;padding:12px;border-radius:8px">${esc(v.note)}</p>` : ""}
        <p style="margin:24px 0"><a href="${await link("approve")}" style="background:#8a6a28;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Review &amp; approve</a>
        &nbsp; <a href="${await link("decline")}" style="color:#8a6a28">Decline</a></p>
        <p style="color:#777;font-size:13px">Reservation fee: ${CONFIG.feeKwd} KD (unpaid — send the payment link after approving). Pending requests free their slot after ${CONFIG.pendingExpiryHours} hours.</p>`, "en"),
      text: `New request ${w.date} ${w.time} from ${v.name} (${v.phone}, ${v.email}). Approve: ${await link("approve")}  Decline: ${await link("decline")}`,
    });
  } catch (e) {
    await env.DB.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
    console.error("owner email failed", e.message || e);
    return json({ ok: false, error: "email_failed" }, 502, req, env);
  }
  // Customer acknowledgement (best effort)
  try {
    const wc = fmtSlot(slot.start, v.lang), t = T.received[v.lang](v, wc);
    await sendEmail(env, { to: v.email, replyTo: env.OWNER_EMAIL, subject: t.subject, html: wrapEmail(t.body, v.lang), text: t.subject });
  } catch (e) { console.error("customer email failed", e.message || e); }

  return json({ ok: true, id, slot: slot.start }, 200, req, env);
}

function decisionPage(inner) {
  return page(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Booking</title><style>body{font:16px/1.6 system-ui,Arial;background:#161616;color:#f4f1ea;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px}
.c{background:#1d1d1d;border:1px solid #2e2e2e;border-radius:16px;padding:28px;max-width:460px;width:100%}h1{font-size:20px;margin:0 0 12px}
button{background:#c9a96a;border:0;border-radius:999px;padding:12px 26px;font:600 16px system-ui;color:#161616;cursor:pointer}.m{color:#a7a29a}</style></head><body><div class="c">${inner}</div></body></html>`);
}

async function handleDecide(req, env) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "", a = u.searchParams.get("a") || "", sig = u.searchParams.get("sig") || "";
  if (!/^[0-9a-f]{24}$/.test(id) || !["approve", "decline"].includes(a)) return decisionPage("<h1>Invalid link</h1>");
  if (!safeEqual(sig, await hmac(env.SIGNING_SECRET, id + "." + a))) return decisionPage("<h1>Invalid or tampered link</h1>");
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first();
  if (!b) return decisionPage("<h1>Booking not found</h1>");
  const w = fmtSlot(b.slot_utc, "en");
  const who = `<p><b>${esc(b.name)}</b><br>${esc(b.phone)} · ${esc(b.email)}<br><span class="m">${w.date} at ${w.time} (Kuwait)</span></p>`;
  if (b.status !== "pending") return decisionPage(`<h1>Already ${esc(b.status)}</h1>${who}`);

  if (req.method === "GET") {                       // GET only shows a button: email scanners can't trigger the decision
    return decisionPage(`<h1>${a === "approve" ? "Approve" : "Decline"} this booking?</h1>${who}
      <form method="POST" action="${esc(u.pathname + u.search)}"><button>${a === "approve" ? "Yes, approve" : "Yes, decline"}</button></form>`);
  }
  const status = a === "approve" ? "confirmed" : "declined";
  const res = await env.DB.prepare("UPDATE bookings SET status = ?, decided_at = ? WHERE id = ? AND status = 'pending'")
    .bind(status, new Date().toISOString(), id).run();
  if (!res.meta || res.meta.changes !== 1) return decisionPage("<h1>Already handled</h1>");
  let mailNote = "The customer has been emailed.";
  try {
    const wc = fmtSlot(b.slot_utc, b.lang), t = T[status][b.lang](b, wc);
    await sendEmail(env, { to: b.email, replyTo: env.OWNER_EMAIL, subject: t.subject, html: wrapEmail(t.body, b.lang), text: t.subject,
      attachments: status === "confirmed" ? [{ filename: "coffee.ics", content: btoa(ics(b)) }] : undefined });
  } catch (e) { console.error("decision email failed", e.message || e); mailNote = "⚠ The customer email failed — please contact them directly."; }
  return decisionPage(`<h1>${status === "confirmed" ? "Approved ✓" : "Declined"}</h1>${who}<p class="m">${mailNote}${status === "confirmed" ? " Remember to send the " + CONFIG.feeKwd + " KD payment link." : ""}</p>`);
}

/* ---------- router ---------- */
export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...SEC_HEADERS, ...corsHeaders(req, env) } });
      if (pathname === "/api/slots" && req.method === "GET") return await handleSlots(req, env);
      if (pathname === "/api/book" && req.method === "POST") return await handleBook(req, env);
      if (pathname === "/api/decide" && (req.method === "GET" || req.method === "POST")) return await handleDecide(req, env);
      return json({ ok: false, error: "not_found" }, 404, req, env);
    } catch (e) {
      console.error("unhandled", e && e.stack || e);
      return json({ ok: false, error: "server_error" }, 500, req, env);
    }
  },
};
