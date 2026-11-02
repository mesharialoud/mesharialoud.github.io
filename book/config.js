// Booking page settings. Fill these in after deploying the booking API (see worker/README.md).
window.BOOKING_CONFIG = {
  // The public address of the booking API, e.g. "https://mesharialoud-booking.YOURNAME.workers.dev"
  // or "https://www.mesharialoud.com" once Cloudflare routes /api/* to it. Leave empty until deployed:
  // the page then shows "booking opens soon" with WhatsApp / email buttons instead of a broken form.
  API_BASE: "",
  // Optional bot protection (Cloudflare Turnstile site key, free). Leave empty to disable.
  TURNSTILE_SITEKEY: "",
  WHATSAPP: "96555665505",
  EMAIL: "its@mesharialoud.com",
};
