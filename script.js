// ---- Contact links -------------------------------------------------
// Add or edit links here. Any entry with an empty `href` is hidden.
const LINKS = [
  { en: "Email",     ar: "البريد الإلكتروني", href: "",  main: true }, // e.g. "mailto:you@example.com"
  { en: "LinkedIn",  ar: "لينكدإن",           href: "" },             // e.g. "https://linkedin.com/in/..."
  { en: "X",         ar: "إكس",               href: "" },
  { en: "Instagram", ar: "إنستغرام",          href: "" },
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
  if (l.main) a.className = "main";
  a.innerHTML = `<span data-l="en">${l.en}</span><span data-l="ar">${l.ar}</span>`;
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
