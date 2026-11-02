// ---- Contact links -------------------------------------------------
// Add or edit links here. Any entry with an empty `href` is hidden.
const ICONS = {
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18v12H3zM3 7l9 7 9-7"/></svg>'
};
const LINKS = [
  { icon: "linkedin", en: "LinkedIn", ar: "لينكدإن", href: "https://www.linkedin.com/in/mesharialoud/" },
  { icon: "phone",    en: "Call",     ar: "اتصال",   href: "tel:+96555665505", sub: "+965 5566 5505" },
  { icon: "whatsapp", en: "WhatsApp", ar: "واتساب",  href: "https://wa.me/96555665505", sub: "+965 5566 5505" },
  { icon: "mail",     en: "Email",    ar: "البريد الإلكتروني", href: "" }, // e.g. "mailto:you@example.com"
];
// --------------------------------------------------------------------

const root = document.documentElement;

function setLang(l) {
  root.lang = l;
  root.dir = l === "ar" ? "rtl" : "ltr";
  document.title = l === "ar"
    ? "مشاري العود — مدير مبيعات ورائد أعمال · الكويت"
    : "Meshari Aloud — Sales Director · Founder · Kuwait";
  try { localStorage.setItem("lang", l); } catch (e) {}
}

let saved = null;
try { saved = localStorage.getItem("lang"); } catch (e) {}
setLang(saved || ((navigator.language || "").startsWith("ar") ? "ar" : "en"));

// ---- Theme (light / dark) ----
function setTheme(t, persist) {
  root.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === "light" ? "#faf7f1" : "#161616";
  if (persist) { try { localStorage.setItem("theme", t); } catch (e) {} }
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("theme"); } catch (e) {}
const mq = window.matchMedia("(prefers-color-scheme: light)");
setTheme(savedTheme || (mq.matches ? "light" : "dark"), false);
mq.addEventListener && mq.addEventListener("change", e => { if (!savedTheme) setTheme(e.matches ? "light" : "dark", false); });
document.getElementById("theme").addEventListener("click", () => {
  savedTheme = root.dataset.theme === "light" ? "dark" : "light";
  setTheme(savedTheme, true);
});

document.getElementById("lang").addEventListener("click", () =>
  setLang(root.lang === "ar" ? "en" : "ar"));

// contact links
const ul = document.getElementById("links");
LINKS.filter(l => l.href).forEach(l => {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = l.href;
  if (!l.href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
  a.setAttribute("aria-label", l.en);
  a.innerHTML = `${ICONS[l.icon]}<span data-l="en">${l.en}</span><span data-l="ar">${l.ar}</span>` +
    (l.sub ? `<span class="sub" dir="ltr">${l.sub}</span>` : "");
  li.appendChild(a);
  ul.appendChild(li);
});

document.getElementById("year").textContent = new Date().getFullYear();

// gentle reveal on scroll
const targets = document.querySelectorAll(".hero-text,.portrait,.about-grid,.card,.contact>*");
targets.forEach(t => t.classList.add("reveal"));
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: .12 });
targets.forEach(t => io.observe(t));
