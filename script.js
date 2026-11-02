// ---- Contact links -------------------------------------------------
// Add or edit links here. Any entry with an empty `href` is hidden.
const ICONS = {
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18v12H3zM3 7l9 7 9-7"/></svg>'
};
const LINKS = [
  { icon: "linkedin",  en: "LinkedIn",  ar: "لينكدإن",  href: "https://www.linkedin.com/in/mesharialoud/" },
  { icon: "instagram", en: "Instagram", ar: "إنستغرام", href: "https://www.instagram.com/mesharialoud" },
  { icon: "mail",      en: "Email",     ar: "البريد الإلكتروني", href: "" }, // e.g. "mailto:you@example.com"
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
  a.innerHTML = `${ICONS[l.icon]}<span data-l="en">${l.en}</span><span data-l="ar">${l.ar}</span>`;
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
